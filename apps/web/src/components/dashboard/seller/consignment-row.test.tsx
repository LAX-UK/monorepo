import type { ConsignmentRecord } from "@/lib/seller/consignment-records";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const deleteDraft = vi.fn();
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/lib/actions/submissions", () => ({
  deleteSubmissionDraftAction: (...args: unknown[]) => deleteDraft(...args),
}));
vi.mock("@/lib/ui/notify", () => ({ notify }));
// Opening a real Radix menu in jsdom is slow; the stand-in lists the items the row hands it.
vi.mock("@auction/ui/components/inline-action-menu", () => ({
  InlineActionMenu: ({
    label,
    items,
  }: {
    label: string;
    items: { type: string; label?: string; onSelect?: () => void; destructive?: boolean }[];
  }) => (
    <div role="menu" aria-label={label}>
      {items.map((item, index) =>
        item.type === "item" ? (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            data-destructive={item.destructive ? "true" : undefined}
            onClick={item.onSelect}
          >
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

describe("ConsignmentRow's Delete draft (GAP-53)", () => {
  beforeEach(() => {
    refresh.mockReset();
    deleteDraft.mockReset();
    notify.success.mockReset();
    notify.error.mockReset();
  });

  const draft = (over: Partial<ConsignmentRecord> = {}) =>
    record({ status: "draft", reference: null, canDeleteDraft: true, ...over });

  it("offers Delete draft last, set apart and destructive, to those who may delete it", () => {
    render(<ConsignmentRow record={draft()} step={null} />);
    const items = screen.getAllByRole("menuitem");
    const last = items.at(-1) as HTMLElement;
    expect(last).toHaveTextContent("Delete draft");
    expect(last).toHaveAttribute("data-destructive", "true");
  });

  it("is not offered when the person may not delete it", () => {
    render(<ConsignmentRow record={draft({ canDeleteDraft: false })} step={null} />);
    expect(screen.queryByRole("menuitem", { name: "Delete draft" })).toBeNull();
  });

  it("asks first, deletes on Delete draft, says Draft deleted and refreshes the list", async () => {
    deleteDraft.mockResolvedValue({ ok: true, data: undefined });
    render(<ConsignmentRow record={draft()} step={null} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete draft" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Delete this draft?");
    expect(dialog).toHaveTextContent("Its photos and answers are removed. This cannot be undone.");
    expect(deleteDraft).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete draft" }));
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Draft deleted"));
    expect(deleteDraft).toHaveBeenCalledWith("s1");
    expect(refresh).toHaveBeenCalled();
    // The row leaves at once, before the refreshed list arrives.
    expect(screen.queryByText("Harbour at dusk, no. 3")).toBeNull();
  });

  it("keeps the dialog open and says why when the API refuses", async () => {
    deleteDraft.mockResolvedValue({
      ok: false,
      error: "Only a draft can be deleted. To stop a work you sent, withdraw it.",
    });
    render(<ConsignmentRow record={draft()} step={null} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete draft" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete draft" }));
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(
        "Only a draft can be deleted. To stop a work you sent, withdraw it.",
      ),
    );
    expect(notify.success).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});

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
