import type { InferenceLogEntry, LoggerConfig } from "./types";

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
    }).catch(() => {});
  }
}
