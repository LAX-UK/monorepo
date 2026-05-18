import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_SUBMISSION_FORM_VALUES } from "./item-submission-form-defaults";
import { useSubmissionWizardController } from "./use-submission-wizard-controller";

const createSubmissionFromValuesAction = vi.fn();
const updateSubmissionFromValuesAction = vi.fn();
const submitForReviewFromValuesAction = vi.fn();

vi.mock("@/lib/actions/submissions", () => ({
  createSubmissionFromValuesAction: (...args: unknown[]) =>
    createSubmissionFromValuesAction(...args),
  updateSubmissionFromValuesAction: (...args: unknown[]) =>
    updateSubmissionFromValuesAction(...args),
  submitForReviewFromValuesAction: (...args: unknown[]) => submitForReviewFromValuesAction(...args),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
}));

const sampleCategoryId = "00000000-0000-4000-8000-000000000001";

function validSubmissionValues() {
  return {
    ...EMPTY_SUBMISSION_FORM_VALUES,
    title: "Test work",
    categoryIds: [sampleCategoryId],
    images: ["https://cdn.example.com/photo.jpg"],
  };
}

describe("useSubmissionWizardController", () => {
  beforeEach(() => {
    createSubmissionFromValuesAction.mockReset();
    updateSubmissionFromValuesAction.mockReset();
    submitForReviewFromValuesAction.mockReset();
    push.mockReset();
    replace.mockReset();
    refresh.mockReset();
    updateSubmissionFromValuesAction.mockResolvedValue({ ok: true, data: {} });
    createSubmissionFromValuesAction.mockResolvedValue({
      ok: true,
      data: { id: "sub-new", redirectTo: "/dashboard/submissions/sub-new" },
    });
    submitForReviewFromValuesAction.mockResolvedValue({ ok: true, data: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces autosave on edit", async () => {
    vi.useFakeTimers();
    const initial = validSubmissionValues();
    const { result } = renderHook(() =>
      useSubmissionWizardController({ kind: "edit", submissionId: "sub-1" }, initial),
    );

    act(() => {
      result.current.form.setValue("title", "Updated title", { shouldDirty: true });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(updateSubmissionFromValuesAction).toHaveBeenCalledTimes(1);
    expect(result.current.autosaveStatus).toBe("saved");
  });

  it("chains create then submit for review in create mode", async () => {
    const { result } = renderHook(() =>
      useSubmissionWizardController({ kind: "create" }, validSubmissionValues()),
    );

    await act(async () => {
      await result.current.submitForReview();
    });

    await waitFor(() => {
      expect(createSubmissionFromValuesAction).toHaveBeenCalledTimes(1);
      expect(submitForReviewFromValuesAction).toHaveBeenCalledWith("sub-new");
      expect(push).toHaveBeenCalledWith("/dashboard/submissions/sub-new");
    });
  });
});
