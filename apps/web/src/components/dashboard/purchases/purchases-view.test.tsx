import { parsePortfolioParams } from "@/lib/dashboard/filters/portfolio/portfolio-filters";
import { buildPortfolioAnalytics } from "@/lib/data/view-models/dashboard-portfolio.vm";
import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PurchasesView } from "./purchases-view";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/purchases",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/hooks/use-dashboard-list-density", () => ({
  useDashboardListRowPaddingClass: () => "",
}));

vi.mock("@/components/dashboard/portfolio-notice-toast", () => ({
  PortfolioNoticeToast: () => null,
}));

vi.mock("@/components/dashboard/portfolio/portfolio-list-toolbar", () => ({
  PortfolioListToolbar: () => <div data-testid="toolbar" />,
}));

vi.mock("@/components/dashboard/portfolio-lot-grid", () => ({
  PortfolioLotGrid: ({ items }: { items: unknown[] }) => <div>{items.length} works</div>,
}));

const empty = buildPortfolioAnalytics([]);

function view(overrides: Partial<ComponentProps<typeof PurchasesView>> = {}) {
  return (
    <PurchasesView
      meta="Buying"
      filters={parsePortfolioParams({})}
      analytics={empty}
      kpiAnalytics={empty}
      shownCount={0}
      payNow={null}
      cards={[]}
      payments={[]}
      loadFailure={null}
      paymentsFailure={null}
      {...overrides}
    />
  );
}

describe("PurchasesView", () => {
  it("names the page Purchases and uses the same word in the empty state", () => {
    render(view());
    expect(screen.getByRole("heading", { name: "Purchases", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("No purchases yet")).toBeInTheDocument();
    expect(screen.queryByText(/collection|portfolio/i)).toBeNull();
  });

  it("pins Pay now when something is due", () => {
    render(view({ payNow: { dueCount: 1, outstandingLabel: "£5,250.00", href: "/pay" } }));
    expect(screen.getByRole("link", { name: "Pay now" })).toHaveAttribute("href", "/pay");
    expect(screen.getByText("Payment due: £5,250.00")).toBeInTheDocument();
  });

  it("shows no Pay now when nothing is due", () => {
    render(view());
    expect(screen.queryByRole("link", { name: "Pay now" })).toBeNull();
  });

  it("lists payments and invoices under their own heading", () => {
    render(
      view({
        payments: [
          {
            id: "p1",
            lotId: "lot-1",
            lotTitle: "Harbour at dusk",
            lotImageUrl: null,
            amountLabel: "£5,250.00",
            createdAtLabel: "14 Sept 2026",
            createdAtIso: "2026-09-14T10:00:00.000Z",
            status: "captured",
            statusLabel: "Paid",
            statusTone: "success",
            primaryAction: { kind: "none" },
            invoiceNumber: "INV-1",
            manualReviewReason: null,
          },
        ],
      }),
    );
    expect(screen.getByRole("heading", { name: "Payments and invoices" })).toBeInTheDocument();
  });

  it("shows the load error instead of the works section", () => {
    render(
      view({
        loadFailure: {
          title: "Could not load purchases",
          message: "Something went wrong while loading your purchases. Try again.",
          actions: [],
        } as never,
      }),
    );
    expect(screen.getByText("Could not load purchases")).toBeInTheDocument();
    expect(screen.queryByText("No purchases yet")).toBeNull();
  });
});
