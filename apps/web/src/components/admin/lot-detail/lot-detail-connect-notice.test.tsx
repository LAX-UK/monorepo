import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LotDetailConnectNotice } from "./lot-detail-connect-notice";

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

import { useSearchParams } from "next/navigation";

describe("LotDetailConnectNotice", () => {
  it("renders nothing when connect is not required", () => {
    render(
      <LotDetailConnectNotice sellerLegalEntityId="seller-1" proactiveConnectRequired={false} />,
    );
    expect(screen.queryByTestId("admin-lot-connect-required-banner")).not.toBeInTheDocument();
  });

  it("shows banner when proactive connect is required", () => {
    render(<LotDetailConnectNotice sellerLegalEntityId="seller-1" proactiveConnectRequired />);
    expect(screen.getByTestId("admin-lot-connect-required-banner")).toBeInTheDocument();
  });

  it("shows banner when error_code=connect_required is in the URL", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("error_code=connect_required") as ReturnType<typeof useSearchParams>,
    );
    render(
      <LotDetailConnectNotice sellerLegalEntityId="seller-1" proactiveConnectRequired={false} />,
    );
    expect(screen.getByTestId("admin-lot-connect-required-banner")).toBeInTheDocument();
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>,
    );
  });
});
