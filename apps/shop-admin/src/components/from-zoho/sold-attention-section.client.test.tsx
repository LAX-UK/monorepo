// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type { AdminSoldAttentionItem } from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/from-zoho",
}));
const dealtWith = vi.fn();
vi.mock("@/server/application/admin-register-actions.server", () => ({
  markNotSold: vi.fn(),
  markDealtWith: (...args: unknown[]) => dealtWith(...args),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { SoldAttentionSection } = await import("./sold-attention-section.client");

const ITEM: AdminSoldAttentionItem = {
  id: "66666666-6666-4666-8666-666666666666",
  registerId: "11111111-1111-4111-8111-111111111111",
  zohoProductId: "1023341000017963004",
  zohoStatus: "Sold",
  place: "lax_art",
  placeRefId: "22222222-2222-4222-8222-222222222222",
  tone: "danger",
  title: "Sold in the gallery: check for an open checkout or invoice",
  body: "Blue Door was marked Sold in Zoho. Any checkout or invoice still open for it is held, not cancelled.",
  actions: [
    { kind: "open_lax_art", label: "Open the lax.art artwork" },
    { kind: "open_in_zoho", label: "Open in Zoho" },
    { kind: "dealt_with", label: "Dealt with" },
  ],
  raisedAt: "2026-11-15T10:00:00.000Z",
};

function show(capabilities: string[]) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(capabilities, "Staff")}>
        <SoldAttentionSection
          items={[ITEM]}
          bidAdminUrl={null}
          zohoUrlTemplate="https://crm.example/{module}/{recordId}"
        />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

describe("SoldAttentionSection: a work sold in the gallery", () => {
  it("links to the lax.art artwork and Zoho, and confirms Dealt with", async () => {
    dealtWith.mockResolvedValue({ ok: true, data: { id: ITEM.id, registerId: ITEM.registerId } });
    show(["artwork_register.read", "artwork_register.review"]);
    expect(screen.getByRole("link", { name: "Open the lax.art artwork" })).toHaveAttribute(
      "href",
      `/artworks/${ITEM.placeRefId}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dealt with" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Nothing is cancelled or refunded for you/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Dealt with" }));
    await vi.waitFor(() =>
      expect(dealtWith).toHaveBeenCalledWith(expect.objectContaining({ attentionId: ITEM.id })),
    );
  });

  it("does not offer Dealt with to someone who can only read", () => {
    show(["artwork_register.read"]);
    expect(screen.queryByRole("button", { name: "Dealt with" })).not.toBeInTheDocument();
  });
});
