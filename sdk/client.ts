import { getProvider } from "../src/lib/providers";
import { InferenceLogger } from "./logger";
import { LoggedProvider } from "./wrapper";

/**
 * Public SDK entry point. Application code calls createLoggedProvider once
 * per request and gets back a provider whose chat/stream calls are
 * automatically logged to the ingestion API.
 */
export function createLoggedProvider(providerName: string, logEndpoint: string) {
  const provider = getProvider(providerName);
  const logger = new InferenceLogger({ endpoint: logEndpoint });
  return new LoggedProvider(provider, logger);
}

export { InferenceLogger } from "./logger";
export { LoggedProvider } from "./wrapper";
export type { InferenceLogEntry, LogStatus } from "./types";
