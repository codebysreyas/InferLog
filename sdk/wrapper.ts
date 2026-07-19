import { randomUUID } from "crypto";
import type { AIProvider, ChatMessage } from "../src/lib/providers/types";
import { InferenceLogger } from "./logger";
import type { InferenceLogEntry } from "./types";

const PREVIEW_LENGTH = 200;

function preview(text: string): string {
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
}

export interface WrapContext {
  conversationId?: string;
  messageId?: string;
}

/**
 * Wraps an AIProvider so every chat/stream call automatically produces an
 * InferenceLogEntry, without the call site having to know about logging.
 */
export class LoggedProvider {
  constructor(
    private readonly provider: AIProvider,
    private readonly logger: InferenceLogger,
  ) {}

  get name() {
    return this.provider.name;
  }

  async chat(messages: ChatMessage[], model: string, ctx: WrapContext = {}) {
    const requestId = randomUUID();
    const start = performance.now();
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    try {
      const result = await this.provider.chat(messages, model);
      this.emit(requestId, ctx, model, start, {
        promptPreview: preview(lastUserMessage),
        completionPreview: preview(result.content),
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        status: "SUCCESS",
      });
      return { requestId, ...result };
    } catch (error) {
      this.emit(requestId, ctx, model, start, {
        promptPreview: preview(lastUserMessage),
        promptTokens: 0,
        completionTokens: 0,
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  async *stream(messages: ChatMessage[], model: string, ctx: WrapContext = {}, signal?: AbortSignal) {
    const requestId = randomUUID();
    const start = performance.now();
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    let full = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let status: "SUCCESS" | "ERROR" | "CANCELLED" = "SUCCESS";
    let errorMessage: string | undefined;

    try {
      for await (const chunk of this.provider.stream(messages, model, signal)) {
        if (chunk.type === "delta") {
          full += chunk.text;
          yield chunk;
        } else {
          promptTokens = chunk.promptTokens;
          completionTokens = chunk.completionTokens;
        }
      }
    } catch (error) {
      status = signal?.aborted ? "CANCELLED" : "ERROR";
      errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw error;
    } finally {
      this.emit(requestId, ctx, model, start, {
        promptPreview: preview(lastUserMessage),
        completionPreview: full ? preview(full) : undefined,
        promptTokens,
        completionTokens,
        status,
        errorMessage,
      });
    }
  }

  private emit(
    requestId: string,
    ctx: WrapContext,
    model: string,
    startedAt: number,
    fields: Omit<InferenceLogEntry, "requestId" | "conversationId" | "messageId" | "provider" | "model" | "latencyMs" | "totalTokens">,
  ) {
    const latencyMs = Math.round(performance.now() - startedAt);
    this.logger.log({
      requestId,
      conversationId: ctx.conversationId,
      messageId: ctx.messageId,
      provider: this.provider.name,
      model,
      latencyMs,
      totalTokens: fields.promptTokens + fields.completionTokens,
      ...fields,
    });
  }
}
