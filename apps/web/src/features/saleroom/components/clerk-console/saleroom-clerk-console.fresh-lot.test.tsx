import { SaleroomClerkConsole } from "@/features/saleroom/components/clerk-console/saleroom-clerk-console";
import { setClerkCommandFetchForTests } from "@/features/saleroom/lib/clerk-commands.client";
import type { AdminSaleroomSessionSnapshot } from "@/lib/data/http/admin.server";
import type { Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Render-level: the console the clerk sees after Try again (a remount from the props it was first
 * loaded with) shows the lot's price and reserve as the server holds them now, not the old props.
 * The real Lot on block panel and live price hook render; only the socket and transport are fakes.
 */

const SALE = "11111111-1111-4111-8111-111111111111";
const LOT = "22222222-2222-4222-8222-222222222222";

vi.mock("@/lib/socket", () => ({
  getSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn() }),
}));
vi.mock("@/features/saleroom/components/saleroom-live-shell", () => ({
  SaleroomLiveShell: ({
    children,
    initial,
  }: {
    children: (args: unknown) => React.ReactNode;
    initial: { status: string; currentLotId: string | null };
  }) =>
    children({
      session: {
        status: initial.status,
        currentLotId: initial.currentLotId,
        isSessionActive: true,
        isSessionLive: true,
        connectionStatus: "connected",
        lastEventAt: null,
      },
      activityLog: [],
      liveFeed: [],
      resyncFromServer: async () => true,
    }),
}));
vi.mock("@/features/saleroom/components/clerk-console/clerk-console-layout", () => ({
  ClerkConsoleLayout: ({ slots }: { slots: Record<string, React.ReactNode> }) => (
    <div>{slots.onBlock}</div>
  ),
}));
vi.mock("@/features/saleroom/hooks/use-clerk-paddle-roster", () => ({
  useClerkPaddleRoster: () => ({ roster: [], refreshRoster: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { error: vi.fn(), success: vi.fn() } }));

/** What the page was first rendered with: the price and reserve before the room moved on. */
const staleLots: Lot[] = [
  {
    id: LOT,
    saleId: SALE,
    lotNumber: 7,
    title: "Harbour at dusk",
    status: "active",
    currentPrice: "500.00",
    startingPrice: "400.00",
    reservePrice: "800.00",
    winnerId: null,
  } as Lot,
];

const initial: AdminSaleroomSessionSnapshot = {
  session: {
    id: "session-1",
    saleId: SALE,
    status: "live",
    currentLotId: LOT,
    clerkUserId: "staff-1",
    auctioneerUserId: null,
    startedAt: null,
    endedAt: null,
    displayOverlay: null,
    createdAt: "2026-11-16T09:00:00.000Z",
    updatedAt: "2026-11-16T09:00:00.000Z",
  },
  events: [],
};

afterEach(() => {
  setClerkCommandFetchForTests(null);
});

describe("SaleroomClerkConsole after Try again", () => {
  it("shows the lot's current price and reserve from the server, not the props it was loaded with", async () => {
    const server = vi.fn(async (input: string) => {
      if (input === `/api/bff/admin/sales/${SALE}/saleroom/lots/${LOT}`) {
        return new Response(
          JSON.stringify({
            data: { lotId: LOT, status: "active", currentPrice: "950.00", reservePrice: "900.00" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    });
    setClerkCommandFetchForTests(server);

    render(
      <SaleroomClerkConsole
        saleId={SALE}
        saleTitle="Evening sale"
        initial={initial}
        lots={staleLots}
      />,
    );

    expect(await screen.findByText("£950.00")).toBeInTheDocument();
    expect(screen.getByText("Reserve £900.00 · met")).toBeInTheDocument();
    expect(screen.queryByText("£500.00")).not.toBeInTheDocument();
    expect(server).toHaveBeenCalledWith(
      `/api/bff/admin/sales/${SALE}/saleroom/lots/${LOT}`,
      expect.objectContaining({ method: "GET" }),
    );
  });
});
