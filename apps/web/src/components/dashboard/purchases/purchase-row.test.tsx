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
    [
      "Overdue since Wed 9 Dec",
      {
        state: "overdue",
        tone: "danger",
        label: "Overdue since Wed 9 Dec",
        title: "Collection overdue since Wed 9 Dec. Storage charges may apply.",
      },
    ],
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

  it("keeps the overdue day on screen and gives the whole sentence as text, not only a title", () => {
    const sentence = "Collection overdue since Wed 9 Dec. Storage charges may apply.";
    render(
      <PurchaseRow
        card={card({
          collection: badge({
            state: "overdue",
            tone: "danger",
            label: "Overdue since Wed 9 Dec",
            title: sentence,
          }),
        })}
        selection={null}
        selectColumn={false}
      />,
    );
    expect(screen.getByText("Overdue since Wed 9 Dec")).toBeVisible();
    expect(screen.getByText(sentence)).toHaveClass("sr-only");
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
        selection={{
          selected: false,
          onSelectedChange,
          label: "Add Blue Abstract No. 3 to a collection visit",
        }}
        selectColumn
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Add Blue Abstract No. 3 to a collection visit" }),
    ).toBeInTheDocument();
  });
});
