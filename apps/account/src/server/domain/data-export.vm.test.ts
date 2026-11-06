import type { SubjectExportView } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import {
  dataExportReturnTo,
  parseDataExportProblem,
  parseDataExportResume,
} from "./data-export-routes";
import {
  buildDataExportPageVm,
  buildDataExportRowSubtitle,
  buildRateLimitedMessage,
  formatDataExportSize,
} from "./data-export.vm";

const NOW = new Date("2026-11-02T14:30:00.000Z");

function view(overrides: Partial<SubjectExportView> = {}): SubjectExportView {
  return {
    id: "exp_1",
    status: "requested",
    requestedAt: "2026-11-02T14:02:00.000Z",
    dueAt: "2026-12-02T14:02:00.000Z",
    readyAt: null,
    expiresAt: null,
    fileName: null,
    sizeBytes: null,
    downloadCount: 0,
    deletedAt: null,
    products: [],
    ...overrides,
  };
}

const READY = {
  status: "ready",
  readyAt: "2026-11-02T14:03:00.000Z",
  expiresAt: "2026-11-09T14:03:00.000Z",
  fileName: "lax-data-2026-11-02.zip",
  sizeBytes: 38_000_000,
} as const;

describe("buildDataExportRowSubtitle", () => {
  it("follows the state", () => {
    expect(buildDataExportRowSubtitle(null, NOW)).toBe(
      "A copy of the information LAX holds about you",
    );
    expect(buildDataExportRowSubtitle(view(), NOW)).toBe("Preparing, we'll email you");
    expect(buildDataExportRowSubtitle(view({ status: "delayed" }), NOW)).toBe(
      "Taking longer than usual",
    );
    expect(buildDataExportRowSubtitle(view({ status: "failed" }), NOW)).toBe(
      "Taking longer than usual",
    );
    expect(buildDataExportRowSubtitle(view(READY), NOW)).toBe("Ready until Mon 9 Nov 2026");
    expect(
      buildDataExportRowSubtitle(
        view({ status: "expired", expiresAt: "2026-11-09T14:03:00.000Z" }),
        NOW,
      ),
    ).toBe("Last copy expired Mon 9 Nov 2026");
    expect(
      buildDataExportRowSubtitle(
        view({ status: "deleted", deletedAt: "2026-11-04T09:00:00.000Z" }),
        NOW,
      ),
    ).toBe("Last copy deleted Wed 4 Nov 2026");
  });

  it("calls a ready copy past its time expired, even before the worker has marked it", () => {
    expect(buildDataExportRowSubtitle(view(READY), new Date("2026-11-10T00:00:00.000Z"))).toBe(
      "Last copy expired Mon 9 Nov 2026",
    );
  });
});

describe("buildDataExportPageVm", () => {
  it("says nothing is known when Identity could not be asked", () => {
    expect(buildDataExportPageVm({ status: "unavailable" }, NOW)).toEqual({ kind: "unavailable" });
  });

  it("offers a request when nothing has been requested (A)", () => {
    expect(buildDataExportPageVm({ status: "ok", view: null }, NOW)).toEqual({
      kind: "ready_to_request",
    });
  });

  it("shows per-product progress while preparing, with every product listed (C)", () => {
    const vm = buildDataExportPageVm(
      {
        status: "ok",
        view: view({
          status: "collecting",
          products: [
            { product: "account", state: "done" },
            { product: "bid", state: "collecting" },
          ],
        }),
      },
      NOW,
      "s.whitfield@example.com",
    );
    expect(vm).toMatchObject({
      kind: "preparing",
      requestedAt: "today at 14:02 GMT",
      email: "s.whitfield@example.com",
    });
    if (vm.kind !== "preparing") throw new Error("expected preparing");
    expect(vm.products.map((p) => [p.name, p.state, p.label])).toEqual([
      ["LAX Account", "done", "Done"],
      ["LAX Bid", "collecting", "Collecting"],
      ["LAX Shop and lax.art", "waiting", "Waiting"],
    ]);
  });

  it("maps each product state one to one, with no assembly while any is unfinished", () => {
    const vm = buildDataExportPageVm(
      {
        status: "ok",
        view: view({
          status: "collecting",
          products: [
            { product: "account", state: "waiting" },
            { product: "bid", state: "collecting" },
            { product: "shop", state: "retrying" },
          ],
        }),
      },
      NOW,
    );
    if (vm.kind !== "preparing") throw new Error("expected preparing");
    expect(vm.products.map((p) => p.label)).toEqual(["Waiting", "Collecting", "Trying again"]);
    expect(vm.assembling).toBe(false);
    const done = buildDataExportPageVm(
      {
        status: "ok",
        view: view({
          status: "collecting",
          products: [
            { product: "account", state: "done" },
            { product: "bid", state: "done" },
            { product: "shop", state: "done" },
          ],
        }),
      },
      NOW,
    );
    if (done.kind !== "preparing") throw new Error("expected preparing");
    expect(done.products.map((p) => p.label)).toEqual(["Done", "Done", "Done"]);
    expect(done.assembling).toBe(true);
  });

  it("names the request day when it was not today", () => {
    const vm = buildDataExportPageVm(
      { status: "ok", view: view({ requestedAt: "2026-11-01T10:00:00.000Z" }) },
      NOW,
    );
    expect(vm).toMatchObject({ kind: "preparing", requestedAt: "Sun 1 Nov, 10:00 GMT" });
  });

  it("shows the legal due date when delayed, and the same page for a failure staff are handling (E)", () => {
    for (const status of ["delayed", "failed"] as const) {
      const vm = buildDataExportPageVm(
        {
          status: "ok",
          view: view({ status, products: [{ product: "bid", state: "retrying" }] }),
        },
        NOW,
      );
      expect(vm).toMatchObject({ kind: "delayed", dueOn: "Wed 2 Dec 2026" });
      if (vm.kind !== "delayed") throw new Error("expected delayed");
      expect(vm.products.find((p) => p.product === "bid")?.label).toBe("Trying again");
    }
  });

  it("shows file, size, expiry and download count when ready (D)", () => {
    expect(buildDataExportPageVm({ status: "ok", view: view(READY) }, NOW)).toEqual({
      kind: "ready",
      exportId: "exp_1",
      fileName: "lax-data-2026-11-02.zip",
      size: "38 MB",
      largeFile: true,
      preparedAt: "Mon 2 Nov, 14:03 GMT",
      availableUntil: "Mon 9 Nov 2026",
      downloads: "not downloaded yet",
    });
    const once = buildDataExportPageVm(
      { status: "ok", view: view({ ...READY, sizeBytes: 2_000_000, downloadCount: 1 }) },
      NOW,
    );
    expect(once).toMatchObject({ largeFile: false, downloads: "downloaded once" });
  });

  it("never offers a download for a ready copy that has no file to show", () => {
    expect(
      buildDataExportPageVm({ status: "ok", view: view({ ...READY, fileName: null }) }, NOW),
    ).toEqual({ kind: "unavailable" });
  });

  it("says when the last copy expired or was deleted (F)", () => {
    expect(
      buildDataExportPageVm(
        {
          status: "ok",
          view: view({ ...READY, status: "expired" }),
        },
        NOW,
      ),
    ).toEqual({
      kind: "expired",
      message:
        "Your last copy, prepared on Mon 2 Nov 2026, expired on Mon 9 Nov 2026 and has been deleted.",
    });
    expect(
      buildDataExportPageVm(
        {
          status: "ok",
          view: view({ ...READY, status: "deleted", deletedAt: "2026-11-04T09:00:00.000Z" }),
        },
        NOW,
      ),
    ).toMatchObject({
      kind: "expired",
      message: expect.stringContaining("You deleted your last copy"),
    });
  });
});

describe("helpers", () => {
  it("formats sizes", () => {
    expect(formatDataExportSize(900)).toBe("1 KB");
    expect(formatDataExportSize(38_400_000)).toBe("38 MB");
    expect(formatDataExportSize(1_500_000_000)).toBe("1.5 GB");
  });

  it("states the over-the-limit date", () => {
    expect(buildRateLimitedMessage("2026-11-20T09:00:00.000Z")).toContain(
      "You can ask again from Fri 20 Nov 2026.",
    );
  });

  it("returns from signing in to the page with what to finish", () => {
    expect(dataExportReturnTo("request")).toBe("/account/privacy/download?resume=request");
    expect(parseDataExportResume("download")).toBe("download");
    expect(parseDataExportResume("other")).toBeNull();
    expect(parseDataExportProblem("step_up_failed")).toBe("step_up_failed");
    expect(parseDataExportProblem("x")).toBeNull();
  });
});
