import { AdminDisputesBoardContainer } from "@/components/admin/admin-disputes-board-container";
import type { AdminDisputesPage } from "@/lib/data/http/disputes.shared";
import { adminDisputesKeys } from "@/lib/data/queries/admin-disputes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mockFetchAdminDisputesPage = vi.fn();
vi.mock("@/lib/data/http/disputes.client", () => ({
  fetchAdminDisputesPage: (...args: unknown[]) => mockFetchAdminDisputesPage(...args),
}));

vi.mock("@/components/admin/disputes-board", () => ({
  AdminDisputesBoard: ({ rows }: { rows: { stripeDisputeId: string }[] }) => (
    <div data-testid="disputes-board">{rows.map((r) => r.stripeDisputeId).join(",")}</div>
  ),
}));

const SEEDED_PAGE: AdminDisputesPage = {
  rows: [
    {
      stripeDisputeId: "dp_123",
      paymentId: "pay_1",
      status: "open",
      amountLabel: "£100.00",
      currency: "gbp",
      reason: "fraudulent",
      reasonLabel: "Fraudulent",
      sellerLegalEntityId: "le_1",
      sellerDisplayName: "Seller Co",
      openedAt: new Date("2026-06-01"),
      closedAt: null,
      outcome: null,
      lotId: null,
      lotTitle: null,
      buyerId: null,
      buyerLabel: null,
      timelineEvents: [],
    },
  ],
  hasNextPage: false,
  summary: { open: 1, underReview: 0, won: 0, lost: 0, closed: 0 },
};

const LIST_PARAMS = { limit: 50, offset: 0 };

function createSeededWrapper(page: AdminDisputesPage = SEEDED_PAGE) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  queryClient.setQueryData(adminDisputesKeys.list(LIST_PARAMS), page);

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("AdminDisputesBoardContainer — hydrated cache", () => {
  it("renders from pre-seeded Query cache without calling the browser queryFn on mount", () => {
    mockFetchAdminDisputesPage.mockClear();

    render(<AdminDisputesBoardContainer params={LIST_PARAMS} />, {
      wrapper: createSeededWrapper(),
    });

    expect(screen.getByTestId("disputes-board")).toHaveTextContent("dp_123");
    expect(mockFetchAdminDisputesPage).not.toHaveBeenCalled();
  });

  it("does not refetch when staleTime has not elapsed (hydrated SSR data)", async () => {
    mockFetchAdminDisputesPage.mockClear();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    queryClient.setQueryData(adminDisputesKeys.list(LIST_PARAMS), SEEDED_PAGE);

    render(<AdminDisputesBoardContainer params={LIST_PARAMS} />, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId("disputes-board")).toBeInTheDocument();
    });

    expect(mockFetchAdminDisputesPage).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(adminDisputesKeys.list(LIST_PARAMS))).toEqual(SEEDED_PAGE);
  });
});
