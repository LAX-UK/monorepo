import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectWithAdminFlash = vi.hoisted(() => vi.fn());
const adminSubmissions = vi.hoisted(() => ({ startReview: vi.fn(), approve: vi.fn() }));
const gate = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/admin/flash/flash.server", () => ({ redirectWithAdminFlash }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  assertAdminCapabilityForRedirect: gate,
  denyUnlessAdminCapability: async () => null,
}));
vi.mock("@/lib/data/write-container.server", () => ({
  getWriteContainer: () => ({ adminSubmissions }),
}));

const { adminApproveSubmissionAction, adminStartSubmissionReviewAction } = await import(
  "./admin-submissions"
);

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("submission actions report failures through the flash message", () => {
  beforeEach(() => {
    redirectWithAdminFlash.mockReset();
    redirectWithAdminFlash.mockResolvedValue(undefined);
    adminSubmissions.startReview.mockReset();
    adminSubmissions.approve.mockReset();
    gate.mockReset();
    gate.mockResolvedValue({ ok: true });
  });

  it("sends the API's refusal to the submission page without putting it in the URL", async () => {
    adminSubmissions.startReview.mockResolvedValue({ ok: false, message: "Already under review" });

    await adminStartSubmissionReviewAction(form({ submissionId: "sub 1" }));

    expect(redirectWithAdminFlash).toHaveBeenCalledWith(
      "/admin/submissions/sub%201",
      "error",
      "Already under review",
    );
  });

  it("sends a denied role to the list with the gate's message", async () => {
    gate.mockResolvedValue({ ok: false, message: "Your role cannot review submissions" });

    await adminStartSubmissionReviewAction(form({ submissionId: "sub-1" }));

    expect(redirectWithAdminFlash).toHaveBeenCalledWith(
      "/admin/submissions",
      "error",
      "Your role cannot review submissions",
    );
    expect(adminSubmissions.startReview).not.toHaveBeenCalled();
  });

  it("reports a missing submission and an invalid form on the right page", async () => {
    await adminApproveSubmissionAction(form({}));
    expect(redirectWithAdminFlash).toHaveBeenLastCalledWith(
      "/admin/submissions",
      "error",
      "Missing submission",
    );

    adminSubmissions.approve.mockResolvedValue({ ok: false, message: "Cannot approve" });
    await adminApproveSubmissionAction(form({ submissionId: "sub-1" }));
    expect(redirectWithAdminFlash).toHaveBeenLastCalledWith(
      "/admin/submissions/sub-1",
      "error",
      "Cannot approve",
    );
  });
});
