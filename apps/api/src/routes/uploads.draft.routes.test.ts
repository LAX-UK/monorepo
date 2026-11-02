import { describe, expect, it, vi } from "vitest";
import type { ContainerUploadRoutesSlice } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createUploadRoutes } from "./uploads.js";

function setup(session: unknown = null) {
  const uploadHttp = {
    createDraftPresignedUpload: vi
      .fn()
      .mockResolvedValue({ status: 200, body: { data: { uploadId: "u1" } } }),
    confirmDraftUpload: vi
      .fn()
      .mockResolvedValue({ status: 200, body: { data: { status: "queued" } } }),
    getDraftUploadStatus: vi
      .fn()
      .mockResolvedValue({ status: 200, body: { data: { status: "active" } } }),
    createPresignedUpload: vi
      .fn()
      .mockResolvedValue({ status: 200, body: { data: { uploadId: "u2" } } }),
  };
  const verify = vi.fn((token: string) => (token === "good" ? { draftId: "draft-1" } : null));
  const routes = createUploadRoutes(
    {
      compliance: { uploadHttp },
      enquiryDraftTokens: { verify },
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    } as unknown as ContainerUploadRoutesSlice,
    { getSessionUser: vi.fn().mockResolvedValue(session) } as unknown as IAuthenticator,
  );
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    routes.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  return { uploadHttp, post, routes };
}

const file = { kind: "enquiry_image", contentType: "image/jpeg", byteSize: 1000 };

describe("uploads with an enquiry draft token", () => {
  it("presigns a file for the draft, without a session", async () => {
    const { post, uploadHttp } = setup();
    const res = await post("/presign", file, { "x-enquiry-draft": "good" });
    expect(res.status).toBe(200);
    expect(uploadHttp.createDraftPresignedUpload).toHaveBeenCalledWith({
      draftId: "draft-1",
      ...file,
    });
    expect(uploadHttp.createPresignedUpload).not.toHaveBeenCalled();
  });

  it("confirms and reads the status of the draft's file", async () => {
    const { post, routes, uploadHttp } = setup();
    await post("/confirm", { uploadId: "u1" }, { "x-enquiry-draft": "good" });
    expect(uploadHttp.confirmDraftUpload).toHaveBeenCalledWith({
      draftId: "draft-1",
      uploadId: "u1",
    });
    await routes.request("/u1", { headers: { "x-enquiry-draft": "good" } });
    expect(uploadHttp.getDraftUploadStatus).toHaveBeenCalledWith({
      draftId: "draft-1",
      uploadId: "u1",
    });
  });

  it("tells the visitor to start again when the token is no longer good, rather than reading it as signed out", async () => {
    const { post, uploadHttp } = setup({ id: "user-1", role: "client", scopes: ["bid.write"] });
    const res = await post("/presign", file, { "x-enquiry-draft": "stale" });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "draft_expired" });
    expect(uploadHttp.createDraftPresignedUpload).not.toHaveBeenCalled();
    expect(uploadHttp.createPresignedUpload).not.toHaveBeenCalled();
  });

  it("still needs a session when there is no token", async () => {
    const { post } = setup(null);
    const res = await post("/presign", file);
    expect(res.status).toBe(401);
  });

  it("keeps using the session for a signed-in sender", async () => {
    const { post, uploadHttp } = setup({
      id: "user-1",
      role: "client",
      scopes: ["bid.read", "bid.write"],
    });
    const res = await post("/presign", file, { Authorization: "Bearer t" });
    expect(res.status).toBe(200);
    expect(uploadHttp.createPresignedUpload).toHaveBeenCalled();
  });
});
