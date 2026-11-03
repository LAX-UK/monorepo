import { beforeEach, describe, expect, it, vi } from "vitest";

const download = vi.fn();
const loadActor = vi.fn();

vi.mock("@/server/container", () => ({
  getLaxAccountContainer: () => ({
    config: { publicOrigin: "https://account.test" },
    dataExports: { download },
  }),
}));
vi.mock("@/server/application/load-account-actor", () => ({ loadActor: () => loadActor() }));

const { POST } = await import("./route");

function post(fields: Record<string, string>, origin: string | null = "https://account.test") {
  return POST(
    new Request("https://account.test/account/privacy/download/file", {
      method: "POST",
      headers: {
        ...(origin ? { origin } : {}),
        "x-forwarded-for": "203.0.113.9",
        "user-agent": "Mozilla/5.0",
      },
      body: new URLSearchParams(fields),
    }),
  );
}

describe("POST /account/privacy/download/file", () => {
  beforeEach(() => {
    download.mockReset();
    loadActor.mockReset();
    loadActor.mockResolvedValue({ accessToken: "t", sid: "s" });
  });

  it("refuses a post from another origin without asking Identity", async () => {
    expect((await post({ id: "exp_1" }, "https://evil.test")).status).toBe(403);
    expect((await post({ id: "exp_1" }, null)).status).toBe(403);
    expect(download).not.toHaveBeenCalled();
  });

  it("redirects (303) to the signed link and forwards the person's address and browser", async () => {
    download.mockResolvedValue({ status: "ok", value: { url: "https://files.test/x?sig=1" } });
    const response = await post({ id: "exp_1" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://files.test/x?sig=1");
    expect(download).toHaveBeenCalledWith({ accessToken: "t", sid: "s" }, "exp_1", {
      ip: "203.0.113.9",
      userAgent: "Mozilla/5.0",
    });
  });

  it("sends an old sign-in through signing in again, back to finish the download", async () => {
    download.mockResolvedValue({ status: "reauth_required" });
    const location = (await post({ id: "exp_1" })).headers.get("location") ?? "";
    expect(location).toContain("https://account.test/api/auth/login?");
    expect(decodeURIComponent(location)).toContain("/account/privacy/download?resume=download");
  });

  it("does not loop: a refusal right after coming back is reported on the page", async () => {
    download.mockResolvedValue({ status: "reauth_required" });
    const response = await post({ id: "exp_1", resumed: "1" });
    expect(response.headers.get("location")).toBe(
      "https://account.test/account/privacy/download?problem=step_up_failed",
    );
  });

  it("returns to the page for a gone copy, and says so for a failure", async () => {
    download.mockResolvedValue({ status: "gone" });
    expect((await post({ id: "exp_1" })).headers.get("location")).toBe(
      "https://account.test/account/privacy/download",
    );
    download.mockResolvedValue({ status: "unavailable" });
    expect((await post({ id: "exp_1" })).headers.get("location")).toBe(
      "https://account.test/account/privacy/download?problem=download_unavailable",
    );
  });

  it("treats a missing id as a gone copy and never calls Identity", async () => {
    expect((await post({})).status).toBe(303);
    expect(download).not.toHaveBeenCalled();
  });
});
