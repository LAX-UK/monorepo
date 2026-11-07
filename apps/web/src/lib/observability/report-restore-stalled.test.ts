import { beforeEach, describe, expect, it, vi } from "vitest";

const captureMessage = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

const { reportRestoreStalled } = await import("./report-restore-stalled");

describe("reportRestoreStalled", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the page's path only, never its query or fragment", () => {
    reportRestoreStalled("/organisations/invitations/accept/abc?token=secret#top");
    const [, options] = captureMessage.mock.calls[0] as [string, { extra: unknown }];
    expect(options.extra).toEqual({ page: "/organisations/invitations/accept/abc" });
    expect(JSON.stringify(captureMessage.mock.calls)).not.toContain("secret");
  });

  it("groups every report under one fingerprint", () => {
    reportRestoreStalled("/home");
    reportRestoreStalled("/bids");
    const fingerprints = captureMessage.mock.calls.map(
      ([, options]) => (options as { fingerprint: string[] }).fingerprint,
    );
    expect(fingerprints[0]).toEqual(["account-restore-stalled"]);
    expect(fingerprints[1]).toEqual(fingerprints[0]);
  });
});
