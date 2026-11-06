import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const markerPresent = { value: false };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    has: (name: string) => name === "lax_account_restored" && markerPresent.value,
  })),
}));
vi.mock("@/lib/navigation/client-request-path.server", () => ({
  resolveClientRequestPath: async () => "/team?tab=roles",
}));
const reportRestoreStalled = vi.fn();
vi.mock("@/lib/observability/report-restore-stalled", () => ({
  reportRestoreStalled: (...args: unknown[]) => reportRestoreStalled(...args),
}));

const { restoreContentFor, restoreFrameFor } = await import("./restore-frame");
const { AccountRestoreFrame } = await import("./account-restore-frame");
const { AccountsUnavailableFrame } = await import("./accounts-unavailable-frame");
const { AccountRestoreHop } = await import(
  "@/components/layout/account-switcher/account-restore-hop"
);
const { AccountsUnavailable } = await import(
  "@/components/layout/account-switcher/accounts-unavailable"
);

const HREF = "/restore-account?next=%2Fteam%3Ftab%3Droles";

describe("restoreFrameFor", () => {
  beforeEach(() => {
    markerPresent.value = false;
    reportRestoreStalled.mockClear();
  });

  it("draws nothing for a browser that has an account", async () => {
    await expect(restoreFrameFor(false)).resolves.toBeNull();
  });

  it("hops through the restore, as a page, back to the page being opened", async () => {
    const frame = (await restoreFrameFor(true)) as ReactElement<{ href: string }>;
    expect(frame.type).toBe(AccountRestoreFrame);
    expect(frame.props.href).toBe(HREF);
    expect(reportRestoreStalled).not.toHaveBeenCalled();
  });

  it("stops and reports when a restore has just run and did not take", async () => {
    markerPresent.value = true;
    const frame = (await restoreFrameFor(true)) as ReactElement<{ retry: unknown }>;
    expect(frame.type).toBe(AccountsUnavailableFrame);
    expect(frame.props.retry).toEqual({ kind: "link", href: HREF });
    expect(reportRestoreStalled).toHaveBeenCalledTimes(1);
  });
});

describe("restoreContentFor", () => {
  beforeEach(() => {
    markerPresent.value = false;
    reportRestoreStalled.mockClear();
  });

  it("hops for a public page that bids as the client, and stops on a second restore", async () => {
    const hop = (await restoreContentFor(true, "/lot/a/b")) as ReactElement<{ href: string }>;
    expect(hop.type).toBe(AccountRestoreHop);
    expect(hop.props.href).toBe("/restore-account?next=%2Flot%2Fa%2Fb");

    markerPresent.value = true;
    const stalled = (await restoreContentFor(true, "/lot/a/b")) as ReactElement;
    expect(stalled.type).toBe(AccountsUnavailable);
    expect(reportRestoreStalled).toHaveBeenCalledTimes(1);
  });
});
