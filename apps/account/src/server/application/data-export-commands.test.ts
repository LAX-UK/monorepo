import { describe, expect, it, vi } from "vitest";
import {
  dataExportClientFromHeaders,
  deleteDataExportCopy,
  requestDataExport,
  signDataExportDownload,
} from "./data-export-commands";

const ACTOR = { accessToken: "token", sid: "sid" };
const CLIENT = { ip: "203.0.113.9", userAgent: "Mozilla/5.0" };

function setup(actor: unknown = ACTOR) {
  const dataExports = {
    request: vi.fn(),
    deleteCopy: vi.fn(),
    download: vi.fn(),
  };
  return {
    dataExports,
    deps: {
      dataExports,
      loadActor: vi.fn(async () => actor as never),
      client: vi.fn(async () => CLIENT),
    },
  };
}

const VIEW = { id: "exp_1" } as never;

describe("requestDataExport", () => {
  it("forwards the person's address and browser with the request", async () => {
    const { deps, dataExports } = setup();
    dataExports.request.mockResolvedValue({
      status: "ok",
      value: { outcome: "requested", export: VIEW },
    });
    expect(await requestDataExport(deps)).toEqual({ status: "requested" });
    expect(dataExports.request).toHaveBeenCalledWith(ACTOR, CLIENT);
  });

  it("treats an already open request as an answer, not a failure", async () => {
    const { deps, dataExports } = setup();
    dataExports.request.mockResolvedValue({
      status: "ok",
      value: { outcome: "already_open", export: VIEW },
    });
    expect(await requestDataExport(deps)).toEqual({ status: "already_open" });
  });

  it("explains the limit with the date the person can ask again", async () => {
    const { deps, dataExports } = setup();
    dataExports.request.mockResolvedValue({
      status: "ok",
      value: { outcome: "rate_limited", retryAfter: "2026-11-20T09:00:00.000Z" },
    });
    const result = await requestDataExport(deps);
    expect(result).toMatchObject({ status: "limited" });
    expect(JSON.stringify(result)).toContain("Fri 20 Nov 2026");
  });

  it("sends a signed-out person, or a refused sign-in, to sign in again", async () => {
    const out = setup("no_session");
    expect(await requestDataExport(out.deps)).toEqual({ status: "reauth_required" });
    expect(out.dataExports.request).not.toHaveBeenCalled();

    const old = setup();
    old.dataExports.request.mockResolvedValue({ status: "reauth_required" });
    expect(await requestDataExport(old.deps)).toEqual({ status: "reauth_required" });
  });

  it("never reports a failure as a request", async () => {
    const down = setup();
    down.dataExports.request.mockResolvedValue({ status: "unavailable" });
    expect(await requestDataExport(down.deps)).toMatchObject({ status: "error" });

    const store = setup("unavailable");
    expect(await requestDataExport(store.deps)).toMatchObject({ status: "error" });
    expect(store.dataExports.request).not.toHaveBeenCalled();
  });
});

describe("deleteDataExportCopy", () => {
  it("deletes, and counts an already-gone copy as deleted", async () => {
    const { deps, dataExports } = setup();
    dataExports.deleteCopy.mockResolvedValue({ status: "ok", value: "deleted" });
    expect(await deleteDataExportCopy(deps, "exp_1")).toEqual({ status: "deleted" });
    dataExports.deleteCopy.mockResolvedValue({ status: "gone" });
    expect(await deleteDataExportCopy(deps, "exp_1")).toEqual({ status: "deleted" });
    expect(dataExports.deleteCopy).toHaveBeenCalledWith(ACTOR, "exp_1");
  });

  it("refuses a blank id, a signed-out person and a failure honestly", async () => {
    const { deps, dataExports } = setup();
    expect(await deleteDataExportCopy(deps, "  ")).toMatchObject({ status: "error" });
    expect(dataExports.deleteCopy).not.toHaveBeenCalled();
    dataExports.deleteCopy.mockResolvedValue({ status: "unavailable" });
    expect(await deleteDataExportCopy(deps, "exp_1")).toMatchObject({ status: "error" });
    expect(await deleteDataExportCopy(setup("no_session").deps, "exp_1")).toEqual({
      status: "reauth_required",
    });
  });
});

describe("signDataExportDownload", () => {
  it("returns the signed link and forwards the person's address and browser", async () => {
    const { deps, dataExports } = setup();
    dataExports.download.mockResolvedValue({ status: "ok", value: { url: "https://files/x" } });
    expect(await signDataExportDownload(deps, "exp_1")).toEqual({
      status: "signed",
      url: "https://files/x",
    });
    expect(dataExports.download).toHaveBeenCalledWith(ACTOR, "exp_1", CLIENT);
  });

  it("asks for a fresh sign-in when Identity wants one", async () => {
    const { deps, dataExports } = setup();
    dataExports.download.mockResolvedValue({ status: "reauth_required" });
    expect(await signDataExportDownload(deps, "exp_1")).toEqual({ status: "reauth_required" });
    expect(await signDataExportDownload(setup("no_session").deps, "exp_1")).toEqual({
      status: "reauth_required",
    });
  });

  it("tells a gone copy from a failure, and never calls Identity without an id", async () => {
    const { deps, dataExports } = setup();
    dataExports.download.mockResolvedValue({ status: "gone" });
    expect(await signDataExportDownload(deps, "exp_1")).toEqual({ status: "gone" });
    dataExports.download.mockResolvedValue({ status: "unavailable" });
    expect(await signDataExportDownload(deps, "exp_1")).toEqual({ status: "error" });
    dataExports.download.mockClear();
    expect(await signDataExportDownload(deps, " ")).toEqual({ status: "gone" });
    expect(dataExports.download).not.toHaveBeenCalled();
  });
});

describe("dataExportClientFromHeaders", () => {
  it("records the platform-resolved address, not the first forwarded entry the browser chose", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.2.3.4, 203.0.113.9, 10.0.0.1",
      "user-agent": "Mozilla/5.0",
    });
    expect(dataExportClientFromHeaders(headers)).toEqual(CLIENT);
  });

  it("falls back to the real-ip header and to nothing", () => {
    expect(dataExportClientFromHeaders(new Headers({ "x-real-ip": "198.51.100.4" }))).toEqual({
      ip: "198.51.100.4",
      userAgent: null,
    });
    expect(dataExportClientFromHeaders(new Headers())).toEqual({ ip: null, userAgent: null });
  });
});
