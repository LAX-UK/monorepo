// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type {
  AdminZohoProductWithoutRegisterList,
  AdminZohoRegisterWithoutProductList,
  AdminZohoStatusMismatchList,
  AdminZohoSyncHealth,
} from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pending: false }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/from-zoho",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/use-list-navigation.client", async () => {
  const actual = await vi.importActual<typeof import("@/components/use-list-navigation.client")>(
    "@/components/use-list-navigation.client",
  );
  return {
    useListNavigation: () => ({ ...actual.useListNavigation(), pending: navigation.pending }),
  };
});
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { SyncHealthView } = await import("./sync-health-view.client");
const { ProductWithoutRegisterList, RegisterWithoutProductList, StatusMismatchList } = await import(
  "./sync-health-drift-list.client"
);

const COUNTS = { new: 4, decisions: 2 };
const T = "2026-11-10T02:30:00.000Z";
const FAILED_JOBS = "https://bid.example/admin/failed-jobs";

const HEALTHY: AdminZohoSyncHealth = {
  modes: { artworkSync: "live", listing: "live", reportedAt: T },
  zohoOff: false,
  inbound: {
    run: { mode: "live", finishedAt: T, seen: 120, changed: 5, leftOut: 4, conflicts: 0 },
  },
  listing: { run: { mode: "live", finishedAt: T, checked: 80, drift: 3, failed: 0 } },
  outbound: { depth: 7, oldestPendingAt: T, deadLettered: 2 },
  token: { status: "ok", refreshedAt: T, expiresAt: T, failureStreak: 0, lastFailureAt: null },
  drift: { registerWithoutProduct: 3, productsWithoutRegister: 0, statusMismatch: 1 },
};

function inShell(node: React.ReactNode) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(["artwork_register.read"], "Read only")}>
        {node}
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

const view = (health: AdminZohoSyncHealth, bidAdminUrl: string | null = "https://bid.example") =>
  inShell(
    <SyncHealthView
      query={{ tab: "health" }}
      counts={COUNTS}
      health={health}
      bidAdminUrl={bidAdminUrl}
    />,
  );

beforeEach(() => {
  navigation.pending = false;
});

describe("Sync health tab", () => {
  it("is a tab of From Zoho and is the one selected", () => {
    view(HEALTHY);
    expect(screen.getByRole("heading", { name: "From Zoho" })).toBeTruthy();
    const tab = screen.getByRole("link", { name: /Sync health/ });
    expect(tab.getAttribute("href")).toBe("/from-zoho?tab=health");
  });

  it("shows the inbound run, the listing check, the queue, the token and the drift counts", () => {
    view(HEALTHY);
    const inbound = screen.getByRole("region", { name: "Last inbound run" });
    expect(within(inbound).getByText("Products seen")).toBeTruthy();
    expect(within(inbound).getByText("120")).toBeTruthy();
    const listing = screen.getByRole("region", { name: "Last listing and Status check" });
    expect(within(listing).getByText("Drift corrected")).toBeTruthy();
    const writes = screen.getByRole("region", { name: "Write queue to Zoho" });
    expect(within(writes).getByText("Waiting to go to Zoho")).toBeTruthy();
    expect(within(writes).getByText("7")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Zoho token" })).toBeTruthy();
    expect(screen.queryByText("LAX cannot get into Zoho")).toBeNull();
  });

  it("links failed writes to Failed jobs, and drift counts to their lists", () => {
    view(HEALTHY);
    const failed = screen.getByRole("link", { name: /Failed for good/ });
    expect(failed.getAttribute("href")).toBe(FAILED_JOBS);
    const drift = screen.getByRole("region", { name: "Drift" });
    expect(
      within(drift)
        .getByRole("link", { name: /In LAX, deleted in Zoho/ })
        .getAttribute("href"),
    ).toBe("/from-zoho?tab=health&drift=register_without_product");
    expect(within(drift).queryByRole("link", { name: /In Zoho, not in LAX/ })).toBeNull();
  });

  it("draws no Failed jobs link when Bid admin is not reachable for this person", () => {
    view(HEALTHY, null);
    expect(screen.queryByRole("link", { name: /Failed for good/ })).toBeNull();
    expect(screen.getByText("Waiting in Failed jobs in LAX Bid admin")).toBeTruthy();
  });

  it("says a failing token is why nothing syncs, as an alert", () => {
    view({
      ...HEALTHY,
      token: { ...HEALTHY.token, status: "failing", failureStreak: 2, lastFailureAt: T },
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("LAX cannot get into Zoho");
    expect(alert.textContent).toContain("twice in a row");
  });

  it("warns, without an alert, when the token is only slipping", () => {
    view({ ...HEALTHY, token: { ...HEALTHY.token, status: "warning", failureStreak: 1 } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status", { name: /needs attention/ })).toBeTruthy();
  });

  it("shows dashes, not zeros, before any run", () => {
    view({
      ...HEALTHY,
      inbound: { run: null },
      listing: { run: null },
      outbound: { depth: 0, oldestPendingAt: null, deadLettered: 0 },
      drift: { registerWithoutProduct: 0, productsWithoutRegister: 0, statusMismatch: 0 },
    });
    const inbound = screen.getByRole("region", { name: "Last inbound run" });
    expect(within(inbound).getAllByText("—")).toHaveLength(4);
    expect(screen.getByText("Nothing is waiting")).toBeTruthy();
  });

  it("says Zoho sync is off and shows no figures", () => {
    view({ ...HEALTHY, modes: null, zohoOff: true });
    expect(screen.getByText("Zoho sync is off")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Last inbound run" })).toBeNull();
  });

  it("shows a loading state while the next view is on its way", () => {
    navigation.pending = true;
    view(HEALTHY);
    expect(screen.getByRole("status", { name: "Loading sync health" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Last inbound run" })).toBeNull();
  });
});

const IDS = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];

describe("drift lists", () => {
  const query = { tab: "health", drift: "register_without_product" } as const;

  it("lists artworks deleted in Zoho, each opening its record", () => {
    const page: AdminZohoRegisterWithoutProductList = {
      items: [
        {
          registerId: IDS[0] as string,
          stockCode: "LAX-ORI-AR-TM-26-0001",
          title: "Harbour at dusk",
          artistName: "Ada Rowe",
          place: "On lax.art",
          foundAt: T,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    };
    inShell(<RegisterWithoutProductList query={query} counts={COUNTS} page={page} />);
    for (const link of screen.getAllByRole("link", { name: "Harbour at dusk" })) {
      expect(link.getAttribute("href")).toBe(`/from-zoho/${IDS[0]}`);
    }
    expect(screen.getAllByText("On lax.art").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Back to Sync health" })).toBeTruthy();
  });

  it("says plainly when nothing has drifted", () => {
    const page = { items: [], total: 0, page: 1, pageSize: 25 };
    inShell(<RegisterWithoutProductList query={query} counts={COUNTS} page={page} />);
    expect(screen.getByText("No artwork has lost its Zoho Product")).toBeTruthy();
  });

  it("lists Zoho Products LAX has no record of and why", () => {
    const page: AdminZohoProductWithoutRegisterList = {
      items: [
        {
          zohoProductId: "9001",
          stockCode: null,
          title: "Untitled sketch",
          reason: "missing_title",
          foundAt: T,
        },
        {
          zohoProductId: "9002",
          stockCode: "LAX-ORI-AR-TM-26-0009",
          title: "Quay",
          reason: null,
          foundAt: T,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 25,
    };
    inShell(
      <ProductWithoutRegisterList
        query={{ tab: "health", drift: "product_without_register" }}
        counts={COUNTS}
        page={page}
      />,
    );
    expect(screen.getAllByText("No title").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Would be added by a live run").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No stock code").length).toBeGreaterThan(0);
  });

  it("lists Status mismatches with what Zoho shows and what LAX writes, and pages", () => {
    const page: AdminZohoStatusMismatchList = {
      items: [
        {
          registerId: IDS[1] as string,
          stockCode: "LAX-ORI-AR-TM-26-0002",
          title: "Quay",
          artistName: "Ada Rowe",
          place: "Sold",
          zohoStatus: null,
          expectedStatus: "Sold",
        },
      ],
      total: 60,
      page: 1,
      pageSize: 25,
    };
    inShell(
      <StatusMismatchList
        query={{ tab: "health", drift: "status_mismatch" }}
        counts={COUNTS}
        page={page}
      />,
    );
    expect(screen.getAllByText("No Status in Zoho").length).toBeGreaterThan(0);
    expect(screen.getByText("1–25 of 60")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Next/ }).getAttribute("href")).toBe(
      "/from-zoho?tab=health&drift=status_mismatch&page=2",
    );
  });
});
