// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAdminJson, loadAdminSession, redirect, sendLog } = vi.hoisted(() => ({
  fetchAdminJson: vi.fn(),
  loadAdminSession: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
  sendLog: vi.fn((_props: Record<string, unknown>) => null),
}));
vi.mock("@/server/application/load-admin-data", () => ({ fetchAdminJson, loadAdminSession }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/leads/release-alert-send-log.client", () => ({
  ReleaseAlertSendLog: sendLog,
}));
vi.mock("@/components/admin-retry-button.client", () => ({ AdminRetryButton: () => null }));

const { default: ReleaseAlertSendsPage } = await import("./page");

const PAGE = { items: [], nextCursor: null };
const SUMMARY = { confirmed: 412, awaitingConfirmation: 9 };

function answer(sends: unknown, summary: unknown = { status: "ok", data: SUMMARY }) {
  fetchAdminJson.mockImplementation(async (path: string) =>
    path.startsWith("release-alerts/sends") ? sends : summary,
  );
}

function signedInAs(capabilities: string[]) {
  loadAdminSession.mockResolvedValue({ status: "ok", data: { capabilities } });
}

async function open(params: Record<string, string> = {}) {
  render(await ReleaseAlertSendsPage({ searchParams: Promise.resolve(params) }));
}

const lastProps = () => sendLog.mock.calls.at(-1)?.[0] as Record<string, unknown>;

beforeEach(() => {
  fetchAdminJson.mockReset();
  sendLog.mockClear();
  signedInAs(["lead.read", "catalogue.read"]);
});

describe("Leads › Release alerts", () => {
  it("reads the page the URL names, 50 at a time, and opens its release", async () => {
    answer({ status: "ok", data: PAGE });
    await open({ cursor: "c2", release: "r1" });
    expect(fetchAdminJson).toHaveBeenCalledWith("release-alerts/sends?limit=50&cursor=c2");
    expect(lastProps()).toMatchObject({
      state: { cursor: "c2", open: "r1" },
      page: PAGE,
      loadFailed: false,
      summary: SUMMARY,
      canOpenArtwork: true,
    });
  });

  it("tells a role the read refuses that it cannot open the page", async () => {
    signedInAs(["order.read"]);
    answer({ status: "forbidden" });
    await open();
    expect(screen.getByRole("heading", { name: "Release alerts" })).toBeInTheDocument();
    expect(screen.getByText("Your role cannot open this page")).toBeInTheDocument();
    expect(sendLog).not.toHaveBeenCalled();
  });

  it("keeps the frame with the error state when the read fails", async () => {
    answer({ status: "failed" });
    await open();
    expect(lastProps()).toMatchObject({ loadFailed: true, page: PAGE });
  });

  it("sends a signed-out person to sign in", async () => {
    answer({ status: "unauthorized" });
    await expect(open()).rejects.toThrow("redirect:/login");
  });

  it("offers the artwork only to roles that can open artworks", async () => {
    signedInAs(["lead.read"]);
    answer({ status: "ok", data: PAGE });
    await open();
    expect(lastProps()).toMatchObject({ canOpenArtwork: false, capabilities: ["lead.read"] });

    signedInAs(["lead.read", "artwork_price.write"]);
    await open();
    expect(lastProps()).toMatchObject({ canOpenArtwork: true });
  });

  it("still lists the releases when the figures above could not be read", async () => {
    answer({ status: "ok", data: PAGE }, { status: "failed" });
    await open();
    expect(lastProps()).toMatchObject({ summary: null, loadFailed: false });
  });
});
