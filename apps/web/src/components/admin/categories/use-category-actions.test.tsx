import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CategoryActionTarget, useCategoryActions } from "./use-category-actions";

const refresh = vi.fn();
const archiveAction = vi.fn();
const deleteAction = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminArchiveCategoryResultAction: (...args: unknown[]) => archiveAction(...args),
  adminDeleteCategoryResultAction: (...args: unknown[]) => deleteAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const category: CategoryActionTarget = {
  id: "cat_1",
  name: "Ceramics",
  archived: false,
  canDelete: false,
};

function Harness({ target }: { target: CategoryActionTarget }) {
  const actions = useCategoryActions();
  return (
    <>
      {actions.actionsFor(target).map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={Boolean(action.disabledReason)}
          onClick={() => action.onSelect?.()}
        >
          {action.label}
        </button>
      ))}
      {actions.dialogs}
    </>
  );
}

describe("useCategoryActions", () => {
  beforeEach(() => {
    for (const fn of [refresh, archiveAction, deleteAction, notifySuccess]) fn.mockReset();
  });

  it("archives only after confirming, then refreshes the list", async () => {
    archiveAction.mockResolvedValue({ ok: true });
    render(<Harness target={category} />);
    fireEvent.click(screen.getByRole("button", { name: "Archive category…" }));
    expect(archiveAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Archive category" }));
    await waitFor(() => expect(archiveAction).toHaveBeenCalledWith("cat_1"));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Ceramics archived"));
    expect(refresh).toHaveBeenCalled();
  });

  it("blocks deleting a category that is still in use, and says why", () => {
    render(<Harness target={category} />);
    expect(screen.getByRole("button", { name: "Delete category…" })).toBeDisabled();
  });

  it("deletes an unused category after confirming", async () => {
    deleteAction.mockResolvedValue({ ok: true });
    render(<Harness target={{ ...category, canDelete: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete category…" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete category" }));
    await waitFor(() => expect(deleteAction).toHaveBeenCalledWith("cat_1"));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Ceramics deleted"));
  });

  it("does not offer archiving an archived category", () => {
    render(<Harness target={{ ...category, archived: true }} />);
    expect(screen.queryByRole("button", { name: "Archive category…" })).not.toBeInTheDocument();
  });
});
