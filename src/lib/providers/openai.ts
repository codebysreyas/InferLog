import type { AIProvider, ChatMessage, ChatResult, StreamChunk } from "./types";
import { ProviderError } from "./types";

const BASE_URL = "https://api.openai.com/v1";

function headers() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ProviderError("OPENAI", "OPENAI_API_KEY is not configured");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export class OpenAIProvider implements AIProvider {
  readonly name = "OPENAI" as const;

  async chat(messages: ChatMessage[], model: string): Promise<ChatResult> {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!res.ok) {
      throw new ProviderError("OPENAI", `OpenAI API error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content ?? "",
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    };
  }

  async *stream(messages: ChatMessage[], model: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model, messages, stream: true }),
      signal,
    });

    if (!res.ok || !res.body) {
      throw new ProviderError("OPENAI", `OpenAI API error (${res.status}): ${await res.text()}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let promptTokens = 0;
    let completionTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;

        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield { type: "delta", text: delta };
        if (json.usage) {
          promptTokens = json.usage.prompt_tokens ?? promptTokens;
          completionTokens = json.usage.completion_tokens ?? completionTokens;
        }
      }
    }

    yield { type: "done", promptTokens, completionTokens };
  }
}
