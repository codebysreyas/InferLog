import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { redactPII } from "@/lib/pii";
import { chatRequestSchema } from "@/lib/validation";
import { createLoggedProvider } from "@sdk/client";

export const runtime = "nodejs";

/**
 * Streams a chat completion back to the client as newline-delimited JSON
 * events while the SDK independently ships an inference log to /api/logs.
 * Persists the conversation/message rows synchronously so the UI has a
 * durable history even if the browser drops the stream.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
  }

  const { conversationId, provider, model, message } = parsed.data;
  const redactedMessage = redactPII(message);

  const conversation = conversationId
    ? await db.conversation.findUnique({ where: { id: conversationId } })
    : await db.conversation.create({
        data: { provider, model, title: redactedMessage.slice(0, 60) },
      });

  if (!conversation) {
    return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404 });
  }

  const history = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });

  const userMessage = await db.message.create({
    data: { conversationId: conversation.id, role: "USER", content: redactedMessage },
  });

  const chatHistory = [
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role.toLowerCase() as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: redactedMessage },
  ];

  const loggedProvider = createLoggedProvider(
    provider,
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/logs`,
  );

  const abortController = new AbortController();
  req.signal.addEventListener("abort", () => abortController.abort());

  const encoder = new TextEncoder();
  const assistantMessageId = randomUUID();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      send({ type: "start", conversationId: conversation.id, messageId: assistantMessageId });

      let full = "";
      try {
        for await (const chunk of loggedProvider.stream(chatHistory, model, {
          conversationId: conversation.id,
          messageId: assistantMessageId,
        }, abortController.signal)) {
          if (chunk.type === "delta") {
            full += chunk.text;
            send({ type: "delta", text: chunk.text });
          }
        }

        await db.message.create({
          data: { id: assistantMessageId, conversationId: conversation.id, role: "ASSISTANT", content: full },
        });
        await db.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });

        send({ type: "done" });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Stream failed" });
      } finally {
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-User-Message-Id": userMessage.id,
    },
  });
}
