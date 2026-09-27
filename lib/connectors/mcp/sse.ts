import type { IncomingMessage } from "node:http";

export type SseEvent = { event: string; data: string; id?: string };

/** Incremental text/event-stream parser (WHATWG rules, enough for MCP). */
export class SseParser {
  private buffer = "";
  private event = "";
  private data: string[] = [];
  private lastId: string | undefined;

  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const out: SseEvent[] = [];
    let index: number;
    while ((index = this.buffer.search(/\r?\n/)) >= 0) {
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + (this.buffer[index] === "\r" ? 2 : 1));
      if (line === "") {
        if (this.data.length) out.push({ event: this.event || "message", data: this.data.join("\n"), id: this.lastId });
        this.event = "";
        this.data = [];
        continue;
      }
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "event") this.event = value;
      else if (field === "data") this.data.push(value);
      else if (field === "id") this.lastId = value;
    }
    return out;
  }
}

/** Read SSE events from a stream until `until` returns true (or the stream ends / the byte cap hits). */
export function readSse(stream: IncomingMessage, onEvent: (event: SseEvent) => boolean | void, maxBytes = 1_000_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const parser = new SseParser();
    let size = 0;
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      stream.removeAllListeners("data");
      if (error) reject(error);
      else resolve();
    };
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      size += Buffer.byteLength(chunk);
      if (size > maxBytes) {
        stream.destroy();
        return finish(new Error("MCP stream too large."));
      }
      for (const event of parser.push(chunk)) {
        if (onEvent(event) === true) {
          stream.destroy();
          return finish();
        }
      }
    });
    stream.on("end", () => finish());
    stream.on("close", () => finish());
    stream.on("error", (error) => finish(error));
  });
}
