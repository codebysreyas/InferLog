import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redactPII } from "@/lib/pii";
import { inferenceLogSchema } from "@/lib/validation";
import { emitInferenceLogged } from "@/lib/events";

/**
 * Ingestion endpoint for the logging SDK. Every inference call — success,
 * error, or cancellation — lands here asynchronously and is persisted
 * independently of the request that produced it.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = inferenceLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  try {
    const log = await db.inferenceLog.create({
      data: {
        requestId: payload.requestId,
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        provider: payload.provider,
        model: payload.model,
        promptPreview: redactPII(payload.promptPreview),
        completionPreview: payload.completionPreview ? redactPII(payload.completionPreview) : null,
        promptTokens: payload.promptTokens,
        completionTokens: payload.completionTokens,
        totalTokens: payload.totalTokens,
        latencyMs: payload.latencyMs,
        status: payload.status,
        errorMessage: payload.errorMessage,
      },
    });

    emitInferenceLogged({
      requestId: log.requestId,
      conversationId: log.conversationId ?? undefined,
      messageId: log.messageId ?? undefined,
      provider: log.provider,
      model: log.model,
      latencyMs: log.latencyMs,
      totalTokens: log.totalTokens,
      status: log.status,
    });

    return NextResponse.json({ id: log.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Duplicate requestId" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to store log" }, { status: 500 });
  }
}
