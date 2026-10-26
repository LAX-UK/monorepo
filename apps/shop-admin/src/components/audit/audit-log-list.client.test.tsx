// @vitest-environment jsdom
import type { AdminAuditFacets, AdminAuditList } from "@auction/shop-contracts";
import { render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/audit",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { AuditLogList } = await import("./audit-log-list.client");
const { auditList } = await import("@/server/domain/people-lists.vm");

const page: AdminAuditList = {
  items: [
    {
      auditId: "11111111-1111-4111-8111-111111111111",
      actorSubjectId: "subject-sam",
      actorName: "Sam Lee",
      actorEmail: "sam@lax.art",
      capability: "payout.mark_paid",
      action: "mark_payout_paid",
      targetType: "shop_payout_ledger",
      targetId: "22222222-2222-4222-8222-222222222222",
      createdAt: "2026-10-20T09:00:00.000Z",
      before: { status: "due" },
      after: { status: "paid", paidReference: "FPS-1" },
    },
    {
      auditId: "33333333-3333-4333-8333-333333333333",
      actorSubjectId: "system:shop-scheduler",
      capability: "stock_hold.write",
      action: "expire_hold",
      targetType: "shop_stock_hold",
      targetId: "44444444-4444-4444-8444-444444444444",
      createdAt: "2026-10-19T09:00:00.000Z",
    },
  ],
  nextCursor: null,
};

const facets: AdminAuditFacets = {
  actions: ["mark_payout_paid", "expire_hold"],
  targetTypes: ["shop_payout_ledger", "shop_stock_hold"],
  actors: [{ subjectId: "subject-sam", name: "Sam Lee", email: "sam@lax.art" }],
};

function renderLog(query: Record<string, string> = {}) {
  render(<AuditLogList state={auditList.parse(query)} page={page} facets={facets} />);
}

const rowOf = (text: string) =>
  within(screen.getByRole("grid")).getByText(text).closest("tr") as HTMLElement;

describe("the audit log", () => {
  it("says who did what to which record, without codes or truncated ids", () => {
    renderLog();
    const paid = rowOf("Payout marked paid");
    expect(within(paid).getByText("Sam Lee")).toBeInTheDocument();
    expect(within(paid).getByRole("link", { name: "Payout" })).toHaveAttribute(
      "href",
      "/payouts?payout=22222222-2222-4222-8222-222222222222",
    );
    expect(within(rowOf("Stock hold expired")).getByText("LAX scheduler")).toBeInTheDocument();
    expect(screen.queryByText(/mark_payout_paid|shop_payout_ledger|22222222/)).toBeNull();
  });

  it("narrows to one person or record from the row menu", () => {
    renderLog();
    const paid = rowOf("Payout marked paid");
    expect(within(paid).getByRole("link", { name: "Only events by Sam Lee" })).toHaveAttribute(
      "href",
      "/audit?actor=subject-sam",
    );
    expect(
      within(rowOf("Stock hold expired")).queryByRole("link", { name: /Only events by/ }),
    ).toBeNull();
  });

  it("shows each filter as a chip in words", () => {
    renderLog({ actor: "subject-sam", action: "mark_payout_paid", from: "2026-10-01" });
    expect(screen.getByRole("button", { name: "Remove filter: By Sam Lee" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: Payout marked paid" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: From 1 Oct 2026" }),
    ).toBeInTheDocument();
  });

  it("opens the event from the URL with what changed", async () => {
    renderLog({ event: "11111111-1111-4111-8111-111111111111" });
    const panel = await screen.findByRole("dialog", { name: /Payout marked paid/ });
    expect(within(panel).getByText("Due → Paid")).toBeInTheDocument();
    expect(within(panel).getByText("FPS-1")).toBeInTheDocument();
  });
});
