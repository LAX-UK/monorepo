import { SaleStatusBadge } from "@/components/marketing/sale-status-badge";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/time/use-client-clock", () => ({
  useClientClock: vi.fn(),
}));

import { useClientClock } from "@/lib/time/use-client-clock";

describe("SaleStatusBadge", () => {
  beforeEach(() => {
    vi.mocked(useClientClock).mockReturnValue(Date.parse("2026-06-01T12:00:00.000Z"));
  });

  it("hides timer for saleroom sale past scheduled end while keeping Live pill", () => {
    render(
      <SaleStatusBadge
        status="active"
        deliveryMode="hybrid"
        endTime="2026-05-31T12:00:00.000Z"
        countdownEndIso="2026-05-31T12:00:00.000Z"
      />,
    );

    expect(screen.getByLabelText(/^live auction$/i)).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByText("Ended")).not.toBeInTheDocument();
  });

  it("shows timer for saleroom sale before scheduled end", () => {
    vi.mocked(useClientClock).mockReturnValue(Date.parse("2026-05-31T12:00:00.000Z"));

    render(
      <SaleStatusBadge
        status="active"
        deliveryMode="hybrid"
        endTime="2026-06-02T12:00:00.000Z"
        countdownEndIso="2026-06-02T12:00:00.000Z"
      />,
    );

    expect(screen.getByLabelText(/live auction, time remaining/i)).toBeInTheDocument();
  });
});
