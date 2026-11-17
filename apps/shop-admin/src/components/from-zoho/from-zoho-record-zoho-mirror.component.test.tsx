// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type { AdminRegisterDetail, AdminZohoMirrorStatus } from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/from-zoho/x",
}));
vi.mock("@/server/application/admin-offer-on-lax-art-actions.server", () => ({
  getLaxArtOfferAssessment: vi.fn(),
  offerOnLaxArt: vi.fn(),
}));
vi.mock("@/server/application/admin-inventory-actions.server", () => ({
  getAuctionOfferAssessment: vi.fn(),
  listAuctionSales: vi.fn(),
  offerAtAuction: vi.fn(),
}));
vi.mock("@/server/application/admin-artwork-actions.server", () => ({
  searchArtistOptions: async () => [],
}));
vi.mock("@/server/application/admin-register-actions.server", () => ({
  resolveRegisterConflict: vi.fn(),
  reopenGallerySale: vi.fn(),
}));
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { FromZohoRecord } = await import("./from-zoho-record.client");
const { presentZohoMirror } = await import("@/server/domain/zoho-mirror.vm");

const REGISTER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-14T15:30:00.000Z");
const FAILED_JOBS = "https://bid.example.test/admin/failed-jobs?source=integrations";

function detail(patch: Partial<AdminRegisterDetail> = {}): AdminRegisterDetail {
  return {
    registerId: REGISTER_ID,
    zohoProductId: "1023341000017963004",
    stockCode: "LAX-ORI-AR-TM-26-0004",
    kind: "original",
    zohoModule: "Products",
    title: "Tidal margin IV",
    artistName: "Ada Rowe",
    artistCode: "AR",
    medium: "Oil on linen",
    dimensions: "90 × 120 cm",
    year: 2024,
    imageCount: 3,
    catalogueStatus: "Available",
    zohoPrice: null,
    offerState: "held",
    whereItIs: {
      key: "not_offered",
      chip: { label: "Not offered", tone: "neutral", marker: "hollow" },
      from: null,
      since: null,
      bidLot: null,
    },
    laxArt: null,
    offerBlockers: [],
    auctionBlockers: [],
    catalogueChanges: [],
    missing: [],
    zohoModifiedAt: "2026-11-04T09:40:00.000Z",
    createdAt: "2026-11-02T02:10:00.000Z",
    conflicts: [],
    events: [],
    gallerySale: null,
    ...patch,
  } as AdminRegisterDetail;
}

function status(over: Partial<AdminZohoMirrorStatus>): AdminZohoMirrorStatus {
  return {
    entity: "artwork",
    id: REGISTER_ID,
    state: "mirrored",
    consumer: "zoho_artwork_writeback",
    notApplicableReason: null,
    mode: "live",
    lastAttemptAt: "2026-11-14T16:02:00.000Z",
    nextRetryAt: null,
    attempts: 1,
    providerReference: null,
    error: null,
    ...over,
  };
}

function show(
  mirror: AdminZohoMirrorStatus | null,
  { record = detail(), failedJobsHref = null as string | null } = {},
) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(["artwork_register.read"], "Read-only")}>
        <FromZohoRecord
          detail={record}
          zohoUrl={null}
          zohoMirror={presentZohoMirror(mirror, { now: NOW, failedJobsHref })}
        />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

/** The header: the title's row, where the record's status badges sit. */
function headerRow() {
  const title = screen.getByRole("heading", { level: 1, name: "Tidal margin IV" });
  return title.parentElement as HTMLElement;
}

async function openDetails(name: string) {
  const badge = within(headerRow()).getByRole("button", { name });
  await act(async () => {
    badge.focus();
    fireEvent.click(badge);
  });
  return { badge, dialog: await screen.findByRole("dialog", { name: /Zoho/ }) };
}

beforeAll(() => {
  // A desk: the details open as a popover (a phone gets the kit's bottom sheet).
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe("the artwork record's Zoho badge", () => {
  it("sits beside Where it is as a button named with its state, and opens Mirrored's details", async () => {
    show(status({ providerReference: "Product:SEED-ZM-1" }));
    expect(within(headerRow()).getByText("Not offered")).toBeInTheDocument();
    const { badge, dialog } = await openDetails("Zoho: Mirrored to Zoho, details");
    expect(badge.tagName).toBe("BUTTON");
    expect(badge).toHaveTextContent("Mirrored to Zoho");
    expect(dialog).toHaveTextContent(
      "Mirrored to ZohoLast sent 14 Nov 2026, 16:02. Zoho record Product:SEED-ZM-1.",
    );
    expect(dialog.querySelector("time")).toHaveAttribute("datetime", "2026-11-14T16:02:00.000Z");
    expect(within(dialog).getByRole("button", { name: "Copy Zoho record ID" })).toBeVisible();
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(badge);
  });

  it("says when it will try again while sending", async () => {
    show(status({ state: "pending", attempts: 1, nextRetryAt: "2026-11-14T16:10:00.000Z" }));
    const { dialog } = await openDetails("Zoho: Sending to Zoho, details");
    expect(dialog).toHaveTextContent(
      "Sending to ZohoWaiting to send the latest change. Tries again at 16:10 (attempt 2).",
    );
  });

  it("links Not in Zoho to Failed jobs only when the person can open it", async () => {
    const failed = status({ state: "failed", error: "Zoho refused: INVALID_DATA on Status" });
    const { unmount } = show(failed, { failedJobsHref: FAILED_JOBS });
    const { dialog } = await openDetails("Zoho: Not in Zoho, details");
    expect(dialog).toHaveTextContent(
      "Not in ZohoZoho refused the last change: Zoho refused: INVALID_DATA on Status. Staff in Failed jobs can fix and replay it.",
    );
    expect(within(dialog).getByRole("link", { name: /^Open in Failed jobs/ })).toHaveAttribute(
      "href",
      FAILED_JOBS,
    );
    unmount();
    show(failed);
    const again = await openDetails("Zoho: Not in Zoho, details");
    expect(within(again.dialog).queryByRole("link")).not.toBeInTheDocument();
  });

  it("explains a dry run", async () => {
    show(status({ state: "dry_run", mode: "dry_run" }));
    const { dialog } = await openDetails("Zoho: Zoho dry run, details");
    expect(dialog).toHaveTextContent(
      "Zoho dry runLAX worked out what it would send and wrote nothing to Zoho.",
    );
  });

  it("shows the badge on a print too, which has no Where it is chip", () => {
    show(status({}), { record: detail({ kind: "print" }) });
    expect(within(headerRow()).queryByText("Not offered")).not.toBeInTheDocument();
    expect(
      within(headerRow()).getByRole("button", { name: "Zoho: Mirrored to Zoho, details" }),
    ).toBeInTheDocument();
  });

  it("draws no badge for an artwork with nothing to mirror, or when the read failed", () => {
    const { unmount } = show(
      status({ state: "not_applicable", notApplicableReason: "not_in_register", mode: null }),
    );
    expect(within(headerRow()).getByText("Not offered")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /^Zoho:/ })).toHaveLength(0);
    unmount();
    show(null);
    expect(screen.queryAllByRole("button", { name: /^Zoho:/ })).toHaveLength(0);
  });
});
