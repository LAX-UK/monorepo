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
    collection: null,
    ...over,
  };
}

describe("PurchaseRow's collection badge", () => {
  const badge = (over: Partial<NonNullable<PurchaseCardVm["collection"]>>) =>
    ({
      state: "upcoming",
      label: "Collect by Mon 4 Jan 2027",
      tone: "neutral",
      shape: "ring",
      title: "Please collect by Mon 4 Jan 2027",
      ...over,
    }) as NonNullable<PurchaseCardVm["collection"]>;

  it.each([
    ["Booked Wed 18 Nov", { state: "booked", tone: "info", label: "Booked Wed 18 Nov" }],
    ["Collect by Mon 4 Jan 2027", {}],
    ["Overdue", { state: "overdue", tone: "danger", label: "Overdue" }],
  ] as const)("draws %s next to the status", (text, over) => {
    render(
      <PurchaseRow
        card={card({ collection: badge(over) })}
        selection={null}
        selectColumn={false}
      />,
    );
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByText("Ready to collect")).toBeInTheDocument();
  });

  it("draws no collection badge when there is none", () => {
    render(<PurchaseRow card={card()} selection={null} selectColumn={false} />);
    expect(screen.queryByText(/Booked|Overdue|Collect by/)).toBeNull();
  });

  it("offers a collect box named for the lot", () => {
    const onSelectedChange = vi.fn();
    render(
      <PurchaseRow
        card={card()}
        selection={{ selected: false, onSelectedChange, label: "Collect Blue Abstract No. 3" }}
        selectColumn
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Collect Blue Abstract No. 3" }),
    ).toBeInTheDocument();
  });
});
