import type { AIProvider, ChatMessage, ChatResult, StreamChunk } from "./types";
import { ProviderError } from "./types";

const BASE_URL = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

function headers() {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new ProviderError("NVIDIA", "NVIDIA_API_KEY is not configured");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export class NvidiaProvider implements AIProvider {
  readonly name = "NVIDIA" as const;

  async chat(messages: ChatMessage[], model: string): Promise<ChatResult> {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!res.ok) {
      const text = await res.text();

      console.error("=== NVIDIA DEBUG ===");
      console.error("URL:", `${BASE_URL}/chat/completions`);
      console.error("Model:", model);
      console.error("Status:", res.status);
      console.error("Response:", text);

      throw new ProviderError("NVIDIA", `NVIDIA API error (${res.status}): ${text}`);
    }

    const data = await res.json();

    return {
      content: data.choices?.[0]?.message?.content ?? "",
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    };
  }

  async *stream(
    messages: ChatMessage[],
    model: string,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamChunk> {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model, messages, stream: true }),
      signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text();

      console.error("=== NVIDIA DEBUG ===");
      console.error("URL:", `${BASE_URL}/chat/completions`);
      console.error("Model:", model);
      console.error("Status:", res.status);
      console.error("Response:", text);

      throw new ProviderError("NVIDIA", `NVIDIA API error (${res.status}): ${text}`);
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

        if (delta) {
          yield { type: "delta", text: delta };
        }

        if (json.usage) {
          promptTokens = json.usage.prompt_tokens ?? promptTokens;
          completionTokens = json.usage.completion_tokens ?? completionTokens;
        }
      }
    }

    yield {
      type: "done",
      promptTokens,
      completionTokens,
    };
  }
}