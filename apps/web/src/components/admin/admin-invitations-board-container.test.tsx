import { AdminInvitationsBoardContainer } from "@/components/admin/admin-invitations-board-container";
import type { AdminInvitationsPage } from "@/lib/data/http/invitations.shared";
import { adminInvitationsKeys } from "@/lib/data/queries/admin-invitations";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mockFetchAdminInvitationsPage = vi.fn();
vi.mock("@/lib/data/http/invitations.client", () => ({
  fetchAdminInvitationsPage: (...args: unknown[]) => mockFetchAdminInvitationsPage(...args),
}));

vi.mock("@/components/admin/admin-invitations-board", () => ({
  AdminInvitationsBoard: ({ rows }: { rows: { email: string }[] }) => (
    <div data-testid="invitations-board">{rows.map((r) => r.email).join(",")}</div>
  ),
}));

const SEEDED_PAGE: AdminInvitationsPage = {
  rows: [
    {
      id: "inv-1",
      email: "alice@example.com",
      targetRole: "staff",
      targetStaffRole: "super_admin",
      status: "pending",
      expiresAt: new Date("2026-07-01"),
      createdAt: new Date("2026-06-01"),
      openedAt: null,
      inviteEmailLastStatus: null,
      invitedByName: null,
    },
  ],
  total: 1,
  pendingTotal: 1,
  acceptedTotal: 0,
};

const LIST_PARAMS = { limit: 50, offset: 0 };

function createSeededWrapper(page: AdminInvitationsPage = SEEDED_PAGE) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  queryClient.setQueryData(adminInvitationsKeys.list(LIST_PARAMS), page);

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("AdminInvitationsBoardContainer — hydrated cache", () => {
  it("renders from pre-seeded Query cache without calling the browser queryFn on mount", () => {
    mockFetchAdminInvitationsPage.mockClear();

    render(<AdminInvitationsBoardContainer params={LIST_PARAMS} />, {
      wrapper: createSeededWrapper(),
    });

    expect(screen.getByTestId("invitations-board")).toHaveTextContent("alice@example.com");
    expect(mockFetchAdminInvitationsPage).not.toHaveBeenCalled();
  });

  it("does not refetch when staleTime has not elapsed (hydrated SSR data)", async () => {
    mockFetchAdminInvitationsPage.mockClear();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    queryClient.setQueryData(adminInvitationsKeys.list(LIST_PARAMS), SEEDED_PAGE);

    render(<AdminInvitationsBoardContainer params={LIST_PARAMS} />, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId("invitations-board")).toBeInTheDocument();
    });

    expect(mockFetchAdminInvitationsPage).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(adminInvitationsKeys.list(LIST_PARAMS))).toEqual(SEEDED_PAGE);
  });
});
