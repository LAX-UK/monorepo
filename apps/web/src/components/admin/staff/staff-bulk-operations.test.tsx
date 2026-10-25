import type { BulkOperation } from "@/lib/admin/bulk-ops/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StaffBulkOperations } from "./staff-bulk-operations";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), action: vi.fn() },
}));

const run = vi.fn();
const noun = { one: "sale", other: "sales" };

function renderOps(operation: BulkOperation) {
  return render(
    <StaffBulkOperations
      operations={[operation]}
      selectedIds={["s1", "s2"]}
      onClear={vi.fn()}
      noun={noun}
    />,
  );
}

describe("StaffBulkOperations", () => {
  beforeEach(() => {
    run.mockReset();
    run.mockResolvedValue({ ok: true });
  });

  it("asks for the reason through the kit confirm and sends it", async () => {
    renderOps({
      id: "cancel",
      label: "Cancel",
      destructive: true,
      reasonPrompt: {
        title: "Cancel the selected sales?",
        description: "Bidding stops.",
        fieldLabel: "Reason for cancelling",
        placeholder: "",
        actionLabel: "Cancel sales",
        minLength: 3,
      },
      run,
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel sales" }));
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a reason of at least 3 characters.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Reason for cancelling"), {
      target: { value: "Venue closed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel sales" }));
    await waitFor(() => expect(run).toHaveBeenCalledWith(["s1", "s2"], { reason: "Venue closed" }));
  });

  it("keeps a destructive operation locked until its phrase is typed", async () => {
    renderOps({
      id: "delete",
      label: "Delete drafts",
      destructive: true,
      typedConfirm: {
        title: "Delete selected draft sales?",
        description: "Removed from the catalogue.",
        actionLabel: "Delete sales",
        confirmationPhrase: (count) => `DELETE ${count} DRAFT SALES`,
      },
      run,
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete drafts" }));
    const confirm = screen.getByRole("button", { name: "Delete sales" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: /to confirm/ }), {
      target: { value: "DELETE 2 DRAFT SALES" },
    });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(run).toHaveBeenCalledWith(["s1", "s2"], {
        confirmationPhrase: "DELETE 2 DRAFT SALES",
      }),
    );
  });

  it("names the count in a plain confirmation", () => {
    renderOps({ id: "publish", label: "Publish", confirm: "Publish all?", run });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(screen.getByRole("heading", { name: "Publish 2 sales?" })).toBeInTheDocument();
  });
});
