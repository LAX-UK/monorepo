import {
  adminConsignmentMoveOptionsAction,
  adminMoveConsignmentAction,
} from "@/lib/actions/admin-consignment-after-sale";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoveConsignmentDialog } from "./move-consignment-dialog";

vi.mock("@/lib/actions/admin-consignment-after-sale", () => ({
  adminConsignmentMoveOptionsAction: vi.fn(),
  adminMoveConsignmentAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const gallery = "99999999-9999-4999-8999-999999999999";

function renderDialog() {
  const onOpenChange = vi.fn();
  render(
    <MoveConsignmentDialog
      open
      onOpenChange={onOpenChange}
      submissionId="s1"
      title="Untitled (Blue)"
    />,
  );
  return { onOpenChange };
}

describe("MoveConsignmentDialog", () => {
  beforeEach(() => {
    vi.mocked(adminConsignmentMoveOptionsAction).mockReset();
    vi.mocked(adminMoveConsignmentAction).mockReset();
  });

  it("offers the seller's organisations, says the acceptance resets, and moves", async () => {
    vi.mocked(adminConsignmentMoveOptionsAction).mockResolvedValue({
      ok: true,
      data: {
        movable: true,
        reason: null,
        options: [{ legalEntityId: gallery, displayName: "Northbank Gallery", role: "admin" }],
        agreementEffect: "reset",
      },
    });
    vi.mocked(adminMoveConsignmentAction).mockResolvedValue({ ok: true });
    const { onOpenChange } = renderDialog();
    const option = await screen.findByRole("radio", { name: /Northbank Gallery/ });
    expect(screen.getByText("The seller's acceptance does not carry over")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Move" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Move to Northbank Gallery" }));
    await waitFor(() => expect(adminMoveConsignmentAction).toHaveBeenCalledWith("s1", gallery));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(refresh).toHaveBeenCalled();
  });

  it("explains why it cannot move", async () => {
    vi.mocked(adminConsignmentMoveOptionsAction).mockResolvedValue({
      ok: true,
      data: {
        movable: false,
        reason: "Only a consignment in a person's own name can be moved to an organisation.",
        options: [],
        agreementEffect: "none",
      },
    });
    renderDialog();
    expect(
      await screen.findByText(
        "Only a consignment in a person's own name can be moved to an organisation.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});
