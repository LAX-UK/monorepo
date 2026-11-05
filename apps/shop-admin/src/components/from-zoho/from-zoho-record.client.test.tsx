// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type { AdminRegisterDetail } from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const assess = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/from-zoho/x",
}));
vi.mock("@/server/application/admin-offer-on-lax-art-actions.server", () => ({
  getLaxArtOfferAssessment: (...args: unknown[]) => assess(...args),
  offerOnLaxArt: vi.fn(),
}));
vi.mock("@/server/application/admin-artwork-actions.server", () => ({
  searchArtistOptions: async () => [],
}));
vi.mock("@/server/application/admin-register-actions.server", () => ({
  resolveRegisterConflict: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { FromZohoRecord } = await import("./from-zoho-record.client");

const NOT_OFFERED = {
  key: "not_offered",
  chip: { label: "Not offered", tone: "neutral", marker: "hollow" },
  from: null,
  since: null,
} as const;

function detail(patch: Partial<AdminRegisterDetail> = {}): AdminRegisterDetail {
  return {
    registerId: "11111111-1111-4111-8111-111111111111",
    zohoProductId: "1023341000017963004",
    stockCode: "LAX-ORI-AR-TM-26-0004",
    kind: "original",
    title: "Tidal margin IV",
    artistName: "Ada Rowe",
    artistCode: "AR",
    medium: "Oil on linen",
    dimensions: "90 × 120 cm",
    year: 2024,
    imageCount: 3,
    catalogueStatus: "Available",
    offerState: "held",
    whereItIs: NOT_OFFERED,
    laxArt: null,
    offerBlockers: [],
    missing: [],
    zohoModifiedAt: "2026-11-04T09:40:00.000Z",
    createdAt: "2026-11-02T02:10:00.000Z",
    conflicts: [],
    events: [],
    ...patch,
  };
}

const EDITOR = [
  "artwork_register.read",
  "artwork_register.review",
  "catalogue.read",
  "catalogue.write",
];
const READ_ONLY = ["artwork_register.read", "catalogue.read"];

function show(record: AdminRegisterDetail, capabilities: string[] = EDITOR) {
  const roleLabel = capabilities.includes("catalogue.write") ? "Catalogue editor" : "Read-only";
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(capabilities, roleLabel)}>
        <FromZohoRecord detail={record} zohoUrl="https://crm.example/Products/1" />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

describe("FromZohoRecord offer on lax.art", () => {
  beforeEach(() => assess.mockReset());

  it("puts Where it is first and offers the artwork on lax.art from the header and the section", () => {
    show(detail());
    const where = screen.getByRole("region", { name: "Where it is" });
    // The badge and the line under it.
    expect(within(where).getAllByText("Not offered")).toHaveLength(2);
    expect(within(where).getByText(/Only one place at a time/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Offer on lax.art…" })).toHaveLength(2);
  });

  it("opens the dialog, which checks the record first", async () => {
    assess.mockResolvedValue({ ok: false, kind: "failed", message: "Could not check." });
    show(detail());
    fireEvent.click(screen.getAllByRole("button", { name: "Offer on lax.art…" })[0] as HTMLElement);
    expect(assess).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(await screen.findByText("Could not check this artwork")).toBeInTheDocument();
  });

  it("keeps the action but disables it, and says why, when Zoho or another place holds the artwork", () => {
    show(
      detail({
        offerBlockers: [
          {
            message:
              "Zoho shows this artwork as reserved. Offer it once Zoho shows it as available.",
            link: { label: "Edit in Zoho", target: "zoho_record" },
          },
        ],
      }),
    );
    for (const button of screen.getAllByRole("button", { name: "Offer on lax.art…" })) {
      expect(button).toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.getByText("This artwork can't go on lax.art yet")).toBeInTheDocument();
    expect(screen.getByText(/shows this artwork as reserved/)).toBeInTheDocument();
  });

  it("opens the lax.art listing once there is one, instead of offering again", () => {
    show(
      detail({
        whereItIs: {
          key: "draft_lax_art",
          chip: { label: "Draft on lax.art", tone: "info", marker: "hollow" },
          from: null,
          since: null,
        },
        laxArt: {
          artworkId: "22222222-2222-4222-8222-222222222222",
          slug: "ada-rowe-tidal-margin-iv",
          published: false,
          createdAt: "2026-11-04T10:42:00.000Z",
        },
        offerBlockers: [],
      }),
    );
    expect(screen.queryByRole("button", { name: "Offer on lax.art…" })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Open on lax.art" })) {
      expect(link).toHaveAttribute("href", "/artworks/22222222-2222-4222-8222-222222222222");
    }
    expect(screen.getByText(/· created /)).toBeInTheDocument();
  });

  it("draws no offer for a print, and says prints are sold in runs on LAX Shop", () => {
    show(
      detail({
        kind: "print",
        offerBlockers: [{ message: "Prints are sold in runs.", link: null }],
      }),
    );
    expect(screen.queryByRole("button", { name: /Offer on lax.art/ })).not.toBeInTheDocument();
    expect(screen.getByText("Prints are sold in runs")).toBeInTheDocument();
    expect(screen.getByText(/on LAX Shop/)).toBeInTheDocument();
  });

  it("leaves the action out for someone who cannot catalogue, and says the page is view only", () => {
    show(detail(), READ_ONLY);
    expect(screen.queryByRole("button", { name: /Offer on lax.art/ })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Where it is" })).toBeInTheDocument();
    expect(screen.getByText("View only")).toBeInTheDocument();
  });
});
