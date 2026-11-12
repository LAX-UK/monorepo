import { describe, expect, it, vi } from "vitest";

const syncFactory = vi.hoisted(() => vi.fn());
vi.mock("./create-zoho-status-sync.js", () => ({ createZohoStatusSync: syncFactory }));
vi.mock("@auction/persistence/repositories", () => ({
  DrizzleZohoListingSourceReader: class {},
}));

import { createZohoStatusNightly } from "./create-zoho-status-nightly.js";

const base = { env: {} as never, db: {} as never, log: {} as never };

describe("createZohoStatusNightly", () => {
  it("schedules the Status check when the writeback is live and the listing is off", () => {
    syncFactory.mockReturnValue({ sync: vi.fn() });
    expect(createZohoStatusNightly({ ...base, listingOn: false })).toBeDefined();
  });

  it("builds nothing when the writeback is off", () => {
    syncFactory.mockReturnValue(undefined);
    expect(createZohoStatusNightly({ ...base, listingOn: false })).toBeUndefined();
  });

  it("leaves the check to the listing's nightly pass when the listing is on", () => {
    syncFactory.mockClear();
    syncFactory.mockReturnValue({ sync: vi.fn() });
    expect(createZohoStatusNightly({ ...base, listingOn: true })).toBeUndefined();
    expect(syncFactory).not.toHaveBeenCalled();
  });
});
