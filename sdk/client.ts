import { getProvider } from "../src/lib/providers";
import { InferenceLogger } from "./logger";
import { LoggedProvider } from "./wrapper";

export function createLoggedProvider(providerName: string, logEndpoint: string) {
  const provider = getProvider(providerName);
  const logger = new InferenceLogger({ endpoint: logEndpoint });
  return new LoggedProvider(provider, logger);
}

export { InferenceLogger } from "./logger";
export { LoggedProvider } from "./wrapper";
export type { InferenceLogEntry, LogStatus } from "./types";
