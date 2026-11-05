import { beforeEach, describe, expect, it, vi } from "vitest";

const alerts = { setTopic: vi.fn() };
const loadAccountSessionHandle = vi.fn();
const revalidatePath = vi.fn();

vi.mock("../container", () => ({ getLaxAccountContainer: () => ({ alerts }) }));
vi.mock("./load-account-record", () => ({
  loadAccountSessionHandle: () => loadAccountSessionHandle(),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

const { setAlertTopicAction } = await import("./alert-preference-actions.server");

const HANDLE = { sessionId: "sess", record: { subject: "user-1" } };

describe("setAlertTopicAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadAccountSessionHandle.mockResolvedValue(HANDLE);
  });

  it("switches a topic as the signed-in person and refreshes the page", async () => {
    alerts.setTopic.mockResolvedValue({ status: "ok" });
    expect(await setAlertTopicAction({ topic: "bid.artists", on: true })).toEqual({
      status: "ok",
      message: "All changes saved",
    });
    expect(alerts.setTopic).toHaveBeenCalledWith(HANDLE, { topic: "bid.artists", on: true });
    expect(revalidatePath).toHaveBeenCalledWith("/account/alerts");
  });

  it("refuses a topic no product offers before calling any product", async () => {
    expect(await setAlertTopicAction({ topic: "bid.everything", on: true })).toMatchObject({
      status: "error",
    });
    expect(alerts.setTopic).not.toHaveBeenCalled();
  });

  it("sends a signed-out person back through sign-in", async () => {
    loadAccountSessionHandle.mockResolvedValue(null);
    expect(await setAlertTopicAction({ topic: "bid.artists", on: true })).toEqual({
      status: "reauth_required",
    });
    alerts.setTopic.mockResolvedValue({ status: "signed_out" });
    loadAccountSessionHandle.mockResolvedValue(HANDLE);
    expect(await setAlertTopicAction({ topic: "bid.artists", on: true })).toEqual({
      status: "reauth_required",
    });
  });

  it("says why a topic cannot be switched on, and when a product cannot be reached", async () => {
    alerts.setTopic.mockResolvedValue({ status: "refused", reason: "unverified" });
    expect(await setAlertTopicAction({ topic: "shop.releases", on: true })).toEqual({
      status: "error",
      message: "Verify your email address to switch alerts on.",
    });
    alerts.setTopic.mockResolvedValue({ status: "unavailable" });
    expect(await setAlertTopicAction({ topic: "shop.releases", on: true })).toMatchObject({
      status: "error",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a session store that cannot be reached as an error, not as signed out", async () => {
    loadAccountSessionHandle.mockRejectedValue(new Error("redis down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await setAlertTopicAction({ topic: "bid.artists", on: true })).toMatchObject({
      status: "error",
    });
  });
});
