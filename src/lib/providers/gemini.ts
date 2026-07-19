import type { AIProvider, ChatMessage, ChatResult, StreamChunk } from "./types";
import { ProviderError } from "./types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function apiKey() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new ProviderError("GEMINI", "GOOGLE_API_KEY is not configured");
  return key;
}

function toContents(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

export class GeminiProvider implements AIProvider {
  readonly name = "GEMINI" as const;

  async chat(messages: ChatMessage[], model: string): Promise<ChatResult> {
    const res = await fetch(`${BASE_URL}/models/${model}:generateContent?key=${apiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: toContents(messages) }),
    });

    if (!res.ok) {
      throw new ProviderError("GEMINI", `Gemini API error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
      promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  async *stream(messages: ChatMessage[], model: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const res = await fetch(
      `${BASE_URL}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: toContents(messages) }),
        signal,
      },
    );

    if (!res.ok || !res.body) {
      throw new ProviderError("GEMINI", `Gemini API error (${res.status}): ${await res.text()}`);
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
        const json = JSON.parse(trimmed.slice(5).trim());
        const delta = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (delta) yield { type: "delta", text: delta };
        if (json.usageMetadata) {
          promptTokens = json.usageMetadata.promptTokenCount ?? promptTokens;
          completionTokens = json.usageMetadata.candidatesTokenCount ?? completionTokens;
        }
      }
    }

    yield { type: "done", promptTokens, completionTokens };
  }
}
