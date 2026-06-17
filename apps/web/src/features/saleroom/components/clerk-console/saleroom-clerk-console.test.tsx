import { SaleroomClerkConsole } from "@/features/saleroom/components/clerk-console/saleroom-clerk-console";
import type { AdminSaleroomSessionSnapshot } from "@/lib/data/http/admin.server";
import type { Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/saleroom/components/saleroom-live-shell", () => ({
  SaleroomLiveShell: ({
    children,
    initial,
  }: {
    children: (args: {
      session: {
        status: string;
        currentLotId: string | null;
        connectionStatus: "connected" | "reconnecting" | "disconnected";
      };
      activityLog: unknown[];
      liveFeed: unknown[];
    }) => React.ReactNode;
    initial: { status: string; currentLotId: string | null };
  }) =>
    children({
      session: {
        status: initial.status,
        currentLotId: initial.currentLotId,
        connectionStatus: "connected",
      },
      activityLog: [],
      liveFeed: [],
    }),
}));

vi.mock("@/features/saleroom/components/clerk-console/clerk-session-bar", () => ({
  ClerkSessionBar: () => <div data-testid="session-bar" />,
}));
vi.mock("@/features/saleroom/components/clerk-console/display-control-panel", () => ({
  DisplayControlPanel: () => <div data-testid="display-control-panel" />,
}));
vi.mock("@/features/saleroom/components/clerk-console/lot-on-block-panel", () => ({
  LotOnBlockPanel: () => <div data-testid="lot-on-block-panel" />,
}));
vi.mock("@/features/saleroom/components/clerk-console/lot-runway-panel", () => ({
  LotRunwayPanel: () => <div data-testid="lot-runway-panel" />,
}));
vi.mock("@/features/saleroom/components/clerk-console/telephone-lines-panel", () => ({
  TelephoneLinesPanel: () => <div data-testid="telephone-lines-panel" />,
}));
vi.mock("@/features/saleroom/components/clerk-console/saleroom-activity-log", () => ({
  SaleroomActivityLog: () => <div data-testid="activity-log" />,
}));
vi.mock("@/features/saleroom/components/clerk-console/clerk-live-action-bar", () => ({
  ClerkLiveActionBar: () => <div data-testid="live-action-bar" />,
}));
vi.mock("@/features/saleroom/hooks/use-clerk-paddle-roster", () => ({
  useClerkPaddleRoster: () => ({ roster: [], refreshRoster: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("@/hooks/use-clerk-lot-live-price", () => ({
  useClerkLotLiveBidState: () => ({
    currentPrice: "100.00",
    bidCount: 0,
    leaderLabel: null,
    recentBids: [],
    placeBid: vi.fn(),
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const lots: Lot[] = [
  {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    title: "Lot one",
    status: "active",
    currentPrice: "100",
    winnerId: null,
  } as Lot,
];

function sessionSnapshot(
  status: AdminSaleroomSessionSnapshot["session"] extends infer S
    ? S extends { status: infer T }
      ? T
      : never
    : never,
  currentLotId: string | null = null,
): AdminSaleroomSessionSnapshot {
  return {
    session: {
      id: "session-1",
      saleId: "sale-1",
      status,
      currentLotId,
      clerkUserId: "staff-1",
      auctioneerUserId: null,
      startedAt: null,
      endedAt: null,
      displayOverlay: null,
      createdAt: "2026-06-17T09:00:00.000Z",
      updatedAt: "2026-06-17T09:00:00.000Z",
    },
    events: [],
  };
}

describe("SaleroomClerkConsole phase layout", () => {
  it("shows setup controls before the session is live", () => {
    render(
      <SaleroomClerkConsole
        saleId="sale-1"
        saleTitle="Evening sale"
        initial={sessionSnapshot("none")}
        lots={lots}
      />,
    );

    expect(screen.getByRole("button", { name: "Go live" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
  });

  it("shows selling panels when live with a lot on block", () => {
    render(
      <SaleroomClerkConsole
        saleId="sale-1"
        saleTitle="Evening sale"
        initial={sessionSnapshot("live", "lot-1")}
        lots={lots}
      />,
    );

    expect(screen.getByTestId("lot-on-block-panel")).toBeInTheDocument();
    expect(screen.getByTestId("lot-runway-panel")).toBeInTheDocument();
    expect(screen.getByTestId("live-action-bar")).toBeInTheDocument();
  });

  it("shows resume control when session is paused", () => {
    render(
      <SaleroomClerkConsole
        saleId="sale-1"
        saleTitle="Evening sale"
        initial={sessionSnapshot("paused", "lot-1")}
        lots={lots}
      />,
    );

    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });
});
