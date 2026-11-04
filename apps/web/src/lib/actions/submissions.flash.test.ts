import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectWithClientFlash = vi.hoisted(() => vi.fn());
const submissions = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  submitForReview: vi.fn(),
  withdraw: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/flash/client-flash.server", () => ({ redirectWithClientFlash }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/data/write-container.server", () => ({
  getWriteContainer: () => ({ submissions }),
}));

const {
  createSubmissionAction,
  submitForReviewAction,
  updateSubmissionAction,
  withdrawSubmissionAction,
} = await import("./submissions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** The flash redirect never returns in production; the stand-in stops the action the same way. */
function stopAfterFlash() {
  redirectWithClientFlash.mockRejectedValue(new Error("FLASH_REDIRECT"));
}

describe("seller submission actions report failures through the flash message", () => {
  beforeEach(() => {
    redirectWithClientFlash.mockReset();
    stopAfterFlash();
    for (const fn of Object.values(submissions)) fn.mockReset();
  });

  it("sends a refused create back to the form without putting the text in the URL", async () => {
    submissions.create.mockResolvedValue({ ok: false, message: "Title is too long" });
    // A form valid enough to reach the API is not needed: either path ends in the flash redirect.
    await expect(createSubmissionAction(form({ title: "x" }))).rejects.toThrow("FLASH_REDIRECT");

    const [path, kind, message] = redirectWithClientFlash.mock.calls[0] ?? [];
    expect(path).toBe("/selling/new");
    expect(kind).toBe("error");
    expect(typeof message).toBe("string");
    expect(String(path)).not.toContain("?");
  });

  it("sends a refused update to the consignment page", async () => {
    submissions.update.mockResolvedValue({ ok: false, message: "Already submitted" });
    await expect(
      updateSubmissionAction(form({ submissionId: "sub-1", title: "A work" })),
    ).rejects.toThrow("FLASH_REDIRECT");

    expect(redirectWithClientFlash.mock.calls[0]?.[0]).toBe("/selling/consignments/sub-1");
    expect(redirectWithClientFlash.mock.calls[0]?.[1]).toBe("error");
  });

  it("sends a refused submit for review to the consignment page", async () => {
    submissions.submitForReview.mockResolvedValue({ ok: false, message: "Add an image first" });

    await expect(submitForReviewAction(form({ submissionId: "sub 1" }))).rejects.toThrow(
      "FLASH_REDIRECT",
    );

    expect(redirectWithClientFlash).toHaveBeenCalledWith(
      "/selling/consignments/sub%201",
      "error",
      "Add an image first",
    );
  });

  it("sends a refused withdrawal to the consignment page", async () => {
    submissions.withdraw.mockResolvedValue({ ok: false, message: "Too late to withdraw" });

    await expect(withdrawSubmissionAction(form({ submissionId: "sub-1" }))).rejects.toThrow(
      "FLASH_REDIRECT",
    );

    expect(redirectWithClientFlash).toHaveBeenCalledWith(
      "/selling/consignments/sub-1",
      "error",
      "Too late to withdraw",
    );
  });

  it("sends a missing submission to the list", async () => {
    await expect(submitForReviewAction(form({}))).rejects.toThrow("FLASH_REDIRECT");
    await expect(withdrawSubmissionAction(form({}))).rejects.toThrow("FLASH_REDIRECT");
    await expect(updateSubmissionAction(form({}))).rejects.toThrow("FLASH_REDIRECT");

    for (const call of redirectWithClientFlash.mock.calls) {
      expect(call).toEqual(["/selling/consignments", "error", "Missing submission"]);
    }
    expect(redirectWithClientFlash).toHaveBeenCalledTimes(3);
  });

  it("leaves the success path alone: a saved submission goes to the list without a message", async () => {
    submissions.submitForReview.mockResolvedValue({ ok: true, data: undefined });

    await expect(submitForReviewAction(form({ submissionId: "sub-1" }))).rejects.toThrow(
      "NEXT_REDIRECT:/selling/consignments/sub-1",
    );
    expect(redirectWithClientFlash).not.toHaveBeenCalled();
  });
});
