import type { StaffAccessDetail } from "@/lib/data/http/staff-access.server";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StaffLaxAccessPanel } from "./staff-lax-access-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/admin/people/staff-access.actions", () => ({
  setShopStaffRoleAction: vi.fn(),
  revokeShopStaffAccessAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({ redirectToHostedReauth: vi.fn() }));

const person = { id: "user_1", name: "Grace Hopper" };

const detail: StaffAccessDetail = {
  subjectId: "user_1",
  platforms: [
    { product: "bid", role: "finance", updatedAt: null, pending: null },
    {
      product: "shop",
      role: null,
      updatedAt: null,
      pending: { action: "granted", role: "finance", requestedAt: "2026-04-01T10:00:00.000Z" },
    },
  ],
  history: [
    {
      at: "2026-04-01T10:00:00.000Z",
      product: "shop",
      action: "granted",
      role: "finance",
      actorSubjectId: "admin_1",
      actorName: "Sara Khan",
      viaInvitation: false,
    },
  ],
};

const renderPanel = (props: { canManage: boolean; detail?: StaffAccessDetail | null }) =>
  render(
    <StaffTooltipProvider>
      <StaffLaxAccessPanel
        person={person}
        detail={props.detail === undefined ? detail : props.detail}
        canManage={props.canManage}
      />
    </StaffTooltipProvider>,
  );

describe("StaffLaxAccessPanel", () => {
  it("shows the role on the other platforms and what is waiting to be applied", () => {
    renderPanel({ canManage: false });

    // Bid roles have their own section on the staff record.
    expect(screen.queryByRole("region", { name: "Bid" })).toBeNull();
    expect(screen.getByRole("region", { name: "Shop" })).toHaveTextContent("No access");
    expect(screen.getByText(/waiting for Shop to apply it/i)).toBeInTheDocument();
    expect(screen.getAllByText("Sara Khan").length).toBeGreaterThan(0);
  });

  it("offers no change controls to a viewer who cannot manage access", () => {
    renderPanel({ canManage: false });
    expect(screen.queryByRole("button", { name: /change|give|remove/i })).toBeNull();
  });

  it("opens the Shop dialog, Cancel first", async () => {
    renderPanel({ canManage: true });

    fireEvent.click(screen.getByRole("button", { name: "Change Shop role" }));
    expect(await screen.findByText("Change Grace Hopper's Shop role")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("says when access could not be loaded", () => {
    renderPanel({ canManage: true, detail: null });
    expect(screen.getByText("LAX access is unavailable")).toBeInTheDocument();
  });
});
