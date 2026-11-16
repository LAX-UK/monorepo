import { SaleroomHeroMetaRow } from "@/components/sections/saleroom/hero/saleroom-hero-meta-row";
import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/marketing/sale-format-line", () => ({ SaleFormatLine: () => null }));
vi.mock("@auction/ui/time", () => ({
  OfficialTime: ({ children }: { children: unknown }) => <span>{children as string}</span>,
}));

const hero = {
  status: "scheduled",
  startTime: "2026-11-16T10:00:00.000Z",
  timeZone: "Europe/London",
  dateLine: "Mon 16 Nov",
  placeLabel: null,
} as unknown as SaleHeroVM;

function renderRow(liveSession: PublicSaleroomSessionStatus | null) {
  return render(
    <SaleroomHeroMetaRow
      hero={hero}
      liveTrailing=""
      deliveryMode="online"
      liveSession={liveSession}
    />,
  );
}

describe("SaleroomHeroMetaRow status badge", () => {
  it("says Live now while the saleroom is live, never Opens …", () => {
    renderRow({ status: "live", currentLotId: "lot-1" });
    expect(screen.getByText("Live now")).toBeTruthy();
    expect(screen.queryByText(/^Opens/)).toBeNull();
  });

  it("also says Live now while the saleroom is paused", () => {
    renderRow({ status: "paused", currentLotId: null });
    expect(screen.getByText("Live now")).toBeTruthy();
  });

  it("keeps the opening time before the saleroom starts", () => {
    renderRow({ status: "none", currentLotId: null });
    expect(screen.queryByText("Live now")).toBeNull();
    expect(screen.getByText(/^Opens/)).toBeTruthy();
  });
});
