import type { ConsignmentRecord } from "@/lib/seller/consignment-records";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// Opening a real Radix menu in jsdom is slow; the stand-in lists the items the row hands it.
vi.mock("@auction/ui/components/inline-action-menu", () => ({
  InlineActionMenu: ({
    label,
    items,
  }: {
    label: string;
    items: { type: string; label?: string; onSelect?: () => void }[];
  }) => (
    <div role="menu" aria-label={label}>
      {items.map((item, index) =>
        item.type === "item" ? (
          <button key={item.label} type="button" role="menuitem" onClick={item.onSelect}>
            {item.label}
          </button>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: separators have no identity.
          <hr key={index} />
        ),
      )}
    </div>
  ),
}));

import { ConsignmentRow } from "./consignment-row";

function record(over: Partial<ConsignmentRecord> = {}): ConsignmentRecord {
  return {
    key: "submission:s1",
    submissionId: "s1",
    lotId: null,
    title: "Harbour at dusk, no. 3",
    image: null,
    reference: "C-1042",
    sentBy: null,
    saleTitle: null,
    status: "in_review",
    stage: "in-review",
    progress: null,
    moment: { value: "1 Nov", label: "sent" },
    price: { empty: "Estimate after review" },
    task: null,
    href: "/selling/consignments/s1",
    lotHref: null,
    agreementHref: null,
    changedAt: 0,
    sentAt: 0,
    ...over,
  } as ConsignmentRecord;
}

describe("ConsignmentRow's menu", () => {
  beforeEach(() => push.mockReset());

  it("offers Sell another like this, starting the wizard from that work", () => {
    render(<ConsignmentRow record={record()} step={null} />);
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["View consignment", "Sell another like this", "Copy reference"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Sell another like this" }));
    expect(push).toHaveBeenCalledWith("/selling/new?copyFrom=s1");
  });

  it.each([
    "draft",
    "needs_changes",
    "agreement",
    "sold",
    "unsold",
    "not_accepted",
    "withdrawn",
  ] as const)("offers it on a %s consignment too", (status) => {
    render(<ConsignmentRow record={record({ status })} step={null} />);
    expect(screen.getByRole("menuitem", { name: "Sell another like this" })).toBeInTheDocument();
  });

  it("leaves it out for a lot with no submission behind it", () => {
    render(
      <ConsignmentRow
        record={record({ submissionId: null, lotId: "l1", href: "/lots/l1", reference: null })}
        step={null}
      />,
    );
    expect(screen.queryByRole("menuitem", { name: "Sell another like this" })).toBeNull();
  });
});
