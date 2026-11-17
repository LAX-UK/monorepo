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

  it("keeps its own tab when the session could not be read", async () => {
    loadAdminSession.mockResolvedValue({ status: "failed" });
    answer({ status: "ok", data: PAGE });
    await open();
    expect(lastProps()).toMatchObject({ capabilities: ["lead.read"], canOpenArtwork: false });
  });
});

describe("a panel link to a release not on the page shown (PRD-7)", () => {
  const ID = "0f0e0d0c-0b0a-4908-8706-000000000040";
  const ON_PAGE = { items: [{ artworkId: "on-page" }], nextCursor: null };
  const ROW = { artworkId: ID, title: "Winter jetty" };

  function answerWith(one: unknown) {
    fetchAdminJson.mockImplementation(async (path: string) => {
      if (path === `release-alerts/sends/${ID}`) return one;
      if (path.startsWith("release-alerts/sends")) return { status: "ok", data: ON_PAGE };
      return { status: "ok", data: SUMMARY };
    });
  }

  it("reads that one release by its work and opens it", async () => {
    answerWith({ status: "ok", data: ROW });
    await open({ release: ID });
    expect(fetchAdminJson).toHaveBeenCalledWith(`release-alerts/sends/${ID}`);
    expect(lastProps()).toMatchObject({ linked: { status: "found", row: ROW } });
  });

  it("says the release is not in the log when the read finds none", async () => {
    answerWith({ status: "not_found" });
    await open({ release: ID });
    expect(lastProps()).toMatchObject({ linked: { status: "not_found", id: ID } });
  });

  it("says it could not be read when the read fails", async () => {
    answerWith({ status: "failed" });
    await open({ release: ID });
    expect(lastProps()).toMatchObject({ linked: { status: "failed", id: ID } });
  });

  it("reads nothing more for a release already on the page, or with no panel open", async () => {
    answerWith({ status: "ok", data: ROW });
    await open({ release: "on-page" });
    expect(lastProps()).toMatchObject({ linked: null });
    await open();
    expect(lastProps()).toMatchObject({ linked: null });
    expect(fetchAdminJson).not.toHaveBeenCalledWith(`release-alerts/sends/${ID}`);
  });
});
