import type { PurchaseCardVm } from "@/lib/purchases/purchases.vm";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { PurchaseRow } from "./purchase-row";

function card(over: Partial<PurchaseCardVm> = {}): PurchaseCardVm {
  return {
    lotId: "l6",
    detailHref: "/purchases/l6",
    lotHref: "/lots/l6",
    image: null,
    title: "Blue Abstract No. 3",
    lotLabel: "Lot 6",
    saleId: "s1",
    saleTitle: "Winter Evening Sale",
    wonBy: null,
    tab: "in-progress",
    state: "ready-for-collection",
    badge: { label: "Ready to collect", tone: "success", shape: "dot" },
    statusLabel: "Paid",
    statusNote: null,
    dueMoment: null,
    amountLabel: "paid",
    amount: "£7,875.00",
    informed: false,
    payable: null,
    dueAt: 0,
    wonAt: 0,
    steps: null,
    breakdown: [],
    primaryAction: null,
    invoiceHref: null,
    problemHref: null,
    collectBy: null,
    ...over,
  };
}

describe("PurchaseRow's collect-by line", () => {
  it("shows the view model's short line while the work waits to be collected", () => {
    render(
      <PurchaseRow
        card={card({
          collectBy: {
            day: "Mon 4 Jan 2027",
            short: "Collect by Mon 4 Jan 2027",
            title: "Please collect by Mon 4 Jan 2027",
            body: "Your work is paid for and waiting at LAX Marylebone.",
            state: "upcoming",
            bookHref: "/purchases/collect?lots=l6",
          },
        })}
        selection={null}
        selectColumn={false}
      />,
    );
    expect(screen.getByText("Collect by Mon 4 Jan 2027")).toBeInTheDocument();
  });

  it("shows no collect-by line when there is none", () => {
    render(<PurchaseRow card={card()} selection={null} selectColumn={false} />);
    expect(screen.queryByText(/Collect by/)).toBeNull();
  });
});
