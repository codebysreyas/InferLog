import { EventEmitter } from "events";

export type InferenceLoggedEvent = {
  requestId: string;
  conversationId?: string;
  messageId?: string;
  provider: string;
  model: string;
  latencyMs: number;
  totalTokens: number;
  status: "SUCCESS" | "ERROR" | "CANCELLED";
};

class EventBus extends EventEmitter {}

/**
 * Process-wide event bus decoupling the ingestion service from downstream
 * consumers (dashboard cache invalidation, future webhooks, etc). Kept as a
 * singleton on globalThis so it survives Next.js dev server hot reloads.
 */
declare global {
  // eslint-disable-next-line no-var
  var __eventBus: EventBus | undefined;
}

export const eventBus = globalThis.__eventBus ?? new EventBus();

if (process.env.NODE_ENV !== "production") {
  globalThis.__eventBus = eventBus;
}

export const INFERENCE_LOGGED = "inference.logged" as const;

export function emitInferenceLogged(payload: InferenceLoggedEvent) {
  eventBus.emit(INFERENCE_LOGGED, payload);
}
