export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ChatResult = {
  content: string;
  promptTokens: number;
  completionTokens: number;
};

export type StreamChunk =
  | { type: "delta"; text: string }
  | { type: "done"; promptTokens: number; completionTokens: number };

export interface AIProvider {
  readonly name: "NVIDIA" | "OPENAI" | "CLAUDE" | "GEMINI";
  chat(messages: ChatMessage[], model: string): Promise<ChatResult>;
  stream(messages: ChatMessage[], model: string, signal?: AbortSignal): AsyncGenerator<StreamChunk>;
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
