import type { AIProvider, ChatMessage, ChatResult, StreamChunk } from "./types";
import { ProviderError } from "./types";

const BASE_URL = "https://api.anthropic.com/v1";

function headers() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ProviderError("CLAUDE", "ANTHROPIC_API_KEY is not configured");
  return {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };
}

function splitSystem(messages: ChatMessage[]) {
  const system = messages.find((m) => m.role === "system")?.content;
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  return { system, rest };
}

export class ClaudeProvider implements AIProvider {
  readonly name = "CLAUDE" as const;

  async chat(messages: ChatMessage[], model: string): Promise<ChatResult> {
    const { system, rest } = splitSystem(messages);
    const res = await fetch(`${BASE_URL}/messages`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model, system, messages: rest, max_tokens: 1024, stream: false }),
    });

    if (!res.ok) {
      throw new ProviderError("CLAUDE", `Claude API error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    return {
      content: data.content?.[0]?.text ?? "",
      promptTokens: data.usage?.input_tokens ?? 0,
      completionTokens: data.usage?.output_tokens ?? 0,
    };
  }

  async *stream(messages: ChatMessage[], model: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const { system, rest } = splitSystem(messages);
    const res = await fetch(`${BASE_URL}/messages`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model, system, messages: rest, max_tokens: 1024, stream: true }),
      signal,
    });

    if (!res.ok || !res.body) {
      throw new ProviderError("CLAUDE", `Claude API error (${res.status}): ${await res.text()}`);
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

        if (json.type === "content_block_delta" && json.delta?.text) {
          yield { type: "delta", text: json.delta.text };
        }
        if (json.type === "message_start") {
          promptTokens = json.message?.usage?.input_tokens ?? promptTokens;
        }
        if (json.type === "message_delta") {
          completionTokens = json.usage?.output_tokens ?? completionTokens;
        }
      }
    }

    yield { type: "done", promptTokens, completionTokens };
  }
}
