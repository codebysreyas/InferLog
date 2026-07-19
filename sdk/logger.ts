import type { InferenceLogEntry, LoggerConfig } from "./types";

/**
 * Fire-and-forget log shipper. Failures are swallowed intentionally: a
 * logging outage must never take down the inference path it's observing.
 */
export class InferenceLogger {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: LoggerConfig) {
    this.endpoint = config.endpoint;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  log(entry: InferenceLogEntry): void {
    void this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {
      // Logging must never break the calling request path.
    });
  }
}
