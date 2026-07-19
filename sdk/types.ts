export type LogStatus = "SUCCESS" | "ERROR" | "CANCELLED";

export interface InferenceLogEntry {
  requestId: string;
  conversationId?: string;
  messageId?: string;
  provider: "NVIDIA" | "OPENAI" | "CLAUDE" | "GEMINI";
  model: string;
  promptPreview: string;
  completionPreview?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  status: LogStatus;
  errorMessage?: string;
}

export interface LoggerConfig {
  endpoint: string;
  fetchImpl?: typeof fetch;
}
