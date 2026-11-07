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
const { restoreContentFor, restoreFrameFor } = await import("./restore-frame");
const { ReportRestoreStalled } = await import(
  "@/components/layout/account-switcher/report-restore-stalled"
);
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
  });

  it("draws nothing for a browser that has an account", async () => {
    await expect(restoreFrameFor(false)).resolves.toBeNull();
  });

  it("hops through the restore, as a page, back to the page being opened", async () => {
    const frame = (await restoreFrameFor(true)) as ReactElement<{ href: string }>;
    expect(frame.type).toBe(AccountRestoreFrame);
    expect(frame.props.href).toBe(HREF);
  });

  it("stops with the retry state, reported when shown, when a restore did not take", async () => {
    markerPresent.value = true;
    const frame = (await restoreFrameFor(true)) as ReactElement<{
      returnTo: string;
      children: ReactElement<{ retry: unknown }>;
    }>;
    expect(frame.type).toBe(ReportRestoreStalled);
    expect(frame.props.returnTo).toBe("/team?tab=roles");
    expect(frame.props.children.type).toBe(AccountsUnavailableFrame);
    expect(frame.props.children.props.retry).toEqual({ kind: "link", href: HREF });
  });
});

describe("restoreContentFor", () => {
  beforeEach(() => {
    markerPresent.value = false;
  });

  it("hops for a public page that bids as the client, and stops on a second restore", async () => {
    const hop = (await restoreContentFor(true, "/lot/a/b")) as ReactElement<{ href: string }>;
    expect(hop.type).toBe(AccountRestoreHop);
    expect(hop.props.href).toBe("/restore-account?next=%2Flot%2Fa%2Fb");

    markerPresent.value = true;
    const stalled = (await restoreContentFor(true, "/lot/a/b")) as ReactElement<{
      children: ReactElement;
    }>;
    expect(stalled.type).toBe(ReportRestoreStalled);
    expect(stalled.props.children.type).toBe(AccountsUnavailable);
  });
});
