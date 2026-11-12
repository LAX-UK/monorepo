// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type { AdminCatalogueChange } from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { update, refresh, toastSuccess } = vi.hoisted(() => ({
  update: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/server/application/admin-catalogue-change-actions.server", () => ({
  updateCatalogueFromZoho: (...args: unknown[]) => update(...args),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { CatalogueChanges } = await import("./catalogue-changes.client");

const REGISTER_ID = "11111111-1111-4111-8111-111111111111";
const EDITOR = ["artwork_register.read", "artwork_register.review", "catalogue.write"];
const READ_ONLY = ["artwork_register.read"];

const titleRow = (changes: boolean) => ({
  field: "title" as const,
  label: "Title",
  laxArtValue: "Tidal margin IV",
  zohoValue: changes ? "Tidal margin V" : "Tidal margin IV",
  changes,
});
const mediumRow = {
  field: "medium" as const,
  label: "Medium",
  laxArtValue: "Oil on linen",
  zohoValue: "Oil on linen",
  changes: false,
};

const draft: AdminCatalogueChange = {
  copy: "lax_art",
  state: "draft",
  comparison: [titleRow(true), mediumRow],
  canUpdate: true,
  note: null,
};
const published: AdminCatalogueChange = {
  ...draft,
  state: "published",
  canUpdate: false,
  note: "This listing is live on lax.art, so it is not changed from Zoho automatically. Edit the listing if it should match.",
};
const inSale: AdminCatalogueChange = {
  ...draft,
  copy: "bid_lot",
  state: "in_sale",
  canUpdate: false,
  note: "This lot is in a sale that is live or coming up, so it is not changed from Zoho. Edit the lot in LAX Bid if it should match.",
};

function show(changes: AdminCatalogueChange[], capabilities: string[] = EDITOR) {
  const label = capabilities.includes("catalogue.write") ? "Catalogue editor" : "Read-only";
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(capabilities, label)}>
        <CatalogueChanges registerId={REGISTER_ID} changes={changes} />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

describe("CatalogueChanges", () => {
  beforeEach(() => {
    for (const fn of [update, refresh, toastSuccess]) fn.mockReset();
  });

  it("shows nothing while every copy matches Zoho", () => {
    const { container } = show([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows what differs, the copy's value beside Zoho's, for a draft listing", () => {
    show([draft]);
    expect(
      screen.getByText("Zoho changed since it was listed: lax.art listing"),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "What differs on the lax.art listing" });
    expect(within(table).getByText("lax.art now")).toBeInTheDocument();
    expect(within(table).getByText("Zoho now")).toBeInTheDocument();
    expect(within(table).getByText("Tidal margin V")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update from Zoho" })).toBeInTheDocument();
  });

  it("copies Zoho's changes into the draft in one click, then refreshes", async () => {
    update.mockResolvedValue({ ok: true, data: { copy: "lax_art", updated: ["Title"] } });
    show([draft]);
    fireEvent.click(screen.getByRole("button", { name: "Update from Zoho" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith({ registerId: REGISTER_ID, copy: "lax_art" });
    expect(toastSuccess).toHaveBeenCalledWith("lax.art listing updated from Zoho");
  });

  it("keeps the difference on screen and says why when the update fails", async () => {
    update.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "This listing is live on lax.art, so it is not changed from Zoho automatically.",
    });
    show([draft]);
    fireEvent.click(screen.getByRole("button", { name: "Update from Zoho" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/live on lax\.art/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("never offers to update a published listing: staff decide", () => {
    show([published]);
    expect(screen.getByText(/keeps what it had until staff decide/)).toBeInTheDocument();
    expect(
      screen.getByText(/is live on lax\.art, so it is not changed from Zoho automatically/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Update from Zoho/ })).not.toBeInTheDocument();
  });

  it("never offers to update a Bid lot in a live or upcoming sale", () => {
    show([inSale]);
    expect(screen.getByText("Zoho changed since it was listed: Bid lot")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "What differs on the Bid lot" })).toBeInTheDocument();
    expect(screen.getByText(/live or coming up/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Update from Zoho/ })).not.toBeInTheDocument();
  });

  it("shows the difference to people who cannot change anything, without the button", () => {
    show([draft], READ_ONLY);
    expect(
      screen.getByRole("table", { name: "What differs on the lax.art listing" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Update from Zoho/ })).not.toBeInTheDocument();
  });

  it("shows a listing and a lot side by side, each with its own update", async () => {
    update.mockResolvedValue({ ok: true, data: { copy: "bid_lot", updated: [] } });
    show([draft, { ...draft, copy: "bid_lot" }]);
    const buttons = screen.getAllByRole("button", { name: "Update from Zoho" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1] as HTMLElement);
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ registerId: REGISTER_ID, copy: "bid_lot" }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Bid lot already matches Zoho");
  });
});
