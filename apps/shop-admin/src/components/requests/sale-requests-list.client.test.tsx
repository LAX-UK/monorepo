// @vitest-environment jsdom
import type { AdminSaleAuthorityRequestList } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const decideSaleAuthorityRequest = vi.fn();

vi.mock("@/server/application/admin-people-actions.server", () => ({
  decideSaleAuthorityRequest,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/requests",
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
const { SaleRequestsList } = await import("./sale-requests-list.client");
const { saleRequestsList } = await import("@/server/domain/sales-lists.vm");

const request = (overrides: Partial<AdminSaleAuthorityRequestList["items"][number]> = {}) => ({
  requestId: "11111111-1111-4111-8111-111111111111",
  artworkId: "22222222-2222-4222-8222-222222222222",
  artworkTitle: "Vessel Study",
  ownerPartyId: "33333333-3333-4333-8333-333333333333",
  ownerDisplayName: "Theo Marsh",
  requestedCount: 3,
  status: "pending",
  createdAt: "2026-10-20T09:00:00.000Z",
  note: "For the autumn fair",
  declineReason: null,
  handledAt: null,
  ...overrides,
});

const page: AdminSaleAuthorityRequestList = {
  items: [
    request(),
    request({
      requestId: "44444444-4444-4444-8444-444444444444",
      artworkTitle: "Night Garden",
      status: "rejected",
      declineReason: "We need the signed agreement.",
      handledAt: "2026-10-21T09:00:00.000Z",
    }),
  ],
  nextCursor: null,
  counts: { pending: 1, rejected: 1 },
};

function renderList(query: Record<string, string> = {}, canDecide = true) {
  render(
    <SaleRequestsList state={saleRequestsList.parse(query)} page={page} canDecide={canDecide} />,
  );
}

const rowOf = (text: string) =>
  within(screen.getByRole("grid")).getByText(text).closest("tr") as HTMLElement;
const choose = (text: string, name: RegExp) => {
  const item = within(rowOf(text)).getByRole("menuitem", { name });
  fireEvent.click(item);
};

beforeEach(() => {
  decideSaleAuthorityRequest.mockReset();
  decideSaleAuthorityRequest.mockResolvedValue({ ok: true, data: { status: "ok" } });
});

describe("the sale limit requests list", () => {
  it("opens on the requests waiting for review, with a count per view", () => {
    renderList();
    expect(screen.getByRole("link", { name: /Waiting for review\s*1/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(rowOf("Vessel Study")).getByText("Asked for 3 editions")).toBeInTheDocument();
  });

  it("offers approve and decline only on a waiting request, and only to a role that decides", () => {
    renderList();
    expect(within(rowOf("Vessel Study")).getByRole("menuitem", { name: /Approve/ })).toBeVisible();
    expect(
      within(rowOf("Night Garden")).queryByRole("menuitem", { name: /Approve|Decline/ }),
    ).not.toBeInTheDocument();
  });

  it("declines with a reason the owner sees, and sends nothing without one", async () => {
    renderList();
    choose("Vessel Study", /Decline/);
    const dialog = await screen.findByRole("dialog", { name: "Decline Theo Marsh’s request?" });
    expect(dialog).toHaveTextContent("Theo Marsh sees this in LAX Account.");

    fireEvent.click(within(dialog).getByRole("button", { name: "Decline request" }));
    expect(within(dialog).getByText("Enter the reason the owner will see.")).toBeInTheDocument();
    expect(decideSaleAuthorityRequest).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "  We need the signed consignment agreement first. " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Decline request" }));
    await waitFor(() => expect(decideSaleAuthorityRequest).toHaveBeenCalledTimes(1));
    expect(decideSaleAuthorityRequest).toHaveBeenCalledWith({
      requestId: "11111111-1111-4111-8111-111111111111",
      decision: "decline",
      declineReason: "We need the signed consignment agreement first.",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("approves the number asked for by default, with the evidence", async () => {
    renderList();
    choose("Vessel Study", /Approve/);
    const dialog = await screen.findByRole("dialog", { name: "Approve Theo Marsh’s request?" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Authorise 3 editions" }));
    expect(
      within(dialog).getByText("Say what the approval is based on, such as a signed agreement."),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Evidence"), {
      target: { value: "Signed agreement on file" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Authorise 3 editions" }));
    await waitFor(() => expect(decideSaleAuthorityRequest).toHaveBeenCalledTimes(1));
    expect(decideSaleAuthorityRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "approve",
        authorisedCount: 3,
        evidenceNote: "Signed agreement on file",
      }),
    );
  });

  it("shows the reason given on a declined request in its panel", async () => {
    renderList({ view: "rejected", request: "44444444-4444-4444-8444-444444444444" });
    const panel = await screen.findByRole("dialog", { name: /Night Garden/ });
    expect(within(panel).getByText("We need the signed agreement.")).toBeInTheDocument();
    expect(within(panel).getByText("For the autumn fair")).toBeInTheDocument();
  });
});
