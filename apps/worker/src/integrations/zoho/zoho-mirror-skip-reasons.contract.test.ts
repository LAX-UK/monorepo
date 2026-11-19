import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * LAX Admin's "Mirrored to Zoho" read gives meaning to the skip reasons these consumers leave in
 * the delivery ledger. Both sides take them from `@auction/types`, so the worker must not write a
 * reason as a bare string a rename there would miss.
 */
const SOURCES = [
  "./fulfilment/order-mirror.ts",
  "./artwork/zoho-artwork-writeback-service.ts",
  "./artwork/listing/zoho-listing-writeback.ts",
  "./artwork/status/zoho-status-sync.ts",
  "../../projectors/zoho-fulfilment-projector.ts",
  "../../projectors/zoho-artwork-writeback-projector.ts",
  "../../projectors/zoho-artwork-listing-projector.ts",
];

describe("Zoho mirror skip reasons and consumers", () => {
  it.each(SOURCES)("%s takes its skip reasons and consumer name from @auction/types", (path) => {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    expect(source).toContain('from "@auction/types"');
    expect(source).not.toMatch(/reason:\s*"/);
    expect(source).not.toMatch(/"zoho_(fulfilment|artwork_writeback|artwork_listing)"/);
  });
});
