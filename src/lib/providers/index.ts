import type { AIProvider } from "./types";
import { NvidiaProvider } from "./nvidia";
import { OpenAIProvider } from "./openai";
import { ClaudeProvider } from "./claude";
import { GeminiProvider } from "./gemini";

const registry: Record<string, AIProvider> = {
  NVIDIA: new NvidiaProvider(),
  OPENAI: new OpenAIProvider(),
  CLAUDE: new ClaudeProvider(),
  GEMINI: new GeminiProvider(),
};

export function getProvider(name: string): AIProvider {
  const provider = registry[name];
  if (!provider) throw new Error(`Unknown provider: ${name}`);
  return provider;
}

export type { AIProvider, ChatMessage, ChatResult, StreamChunk } from "./types";
export { ProviderError } from "./types";
