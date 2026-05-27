import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaleDetailConnectNotice } from "./sale-detail-connect-notice";

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

import { useSearchParams } from "next/navigation";

describe("SaleDetailConnectNotice", () => {
  const lots = [{ id: "lot-1", sellerLegalEntityId: "seller-1" }];

  it("renders nothing when no connect blockers", () => {
    render(<SaleDetailConnectNotice lots={lots} />);
    expect(screen.queryByTestId("admin-lot-connect-required-banner")).not.toBeInTheDocument();
  });

  it("shows banner when a lot requires connect proactively", () => {
    render(<SaleDetailConnectNotice lots={lots} connectRequiredByLotId={{ "lot-1": true }} />);
    expect(screen.getByTestId("admin-lot-connect-required-banner")).toBeInTheDocument();
  });

  it("shows banner when error_code=connect_required is in the URL", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("error_code=connect_required") as ReturnType<typeof useSearchParams>,
    );
    render(<SaleDetailConnectNotice lots={lots} />);
    expect(screen.getByTestId("admin-lot-connect-required-banner")).toBeInTheDocument();
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>,
    );
  });
});
