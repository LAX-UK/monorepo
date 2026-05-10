import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { PINO_REDACT } from "./logger.js";

describe("PINO_REDACT", () => {
  it("censors stripeSecretKey in serialized log output", async () => {
    const chunks: string[] = [];
    const dest = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk.toString());
        cb();
      },
    });
    const log = pino({ level: "info", redact: PINO_REDACT, sync: true }, dest);
    log.info({ stripeSecretKey: "sk_test_should_not_appear", ok: true });
    const line = chunks.join("");
    expect(line).toContain("[REDACTED]");
    expect(line).not.toContain("sk_test_should_not_appear");
    expect(line).toContain('"ok":true');
  });
});
