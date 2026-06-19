import { SaleParticipationTimeline } from "@/components/marketing/sale-participation-timeline";
import { ADMIN_CANNOT_BUY_TITLE } from "@/lib/ui/admin-cannot-buy";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const baseProps = {
  deliveryMode: "online" as const,
  isAuthenticated: true,
  kycApproved: false,
  startTime: new Date(Date.now() + 86400000).toISOString(),
  endTime: new Date(Date.now() + 172800000).toISOString(),
};

describe("SaleParticipationTimeline staff gating", () => {
  it("renders nothing for staff viewers", () => {
    const { container } = render(
      <SaleParticipationTimeline {...baseProps} canParticipate={false} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/guide/i)).not.toBeInTheDocument();
    expect(screen.queryByText(ADMIN_CANNOT_BUY_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /verify identity/i })).not.toBeInTheDocument();
  });

  it("shows verify step for authenticated clients who cannot participate yet", () => {
    render(<SaleParticipationTimeline {...baseProps} canParticipate />);

    expect(screen.queryByText(ADMIN_CANNOT_BUY_TITLE)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /verify identity/i })).toBeInTheDocument();
  });

  it("renders nothing for staff on onsite sales", () => {
    const { container } = render(
      <SaleParticipationTimeline
        deliveryMode="onsite"
        isAuthenticated
        kycApproved={false}
        canParticipate={false}
        startTime={baseProps.startTime}
        endTime={baseProps.endTime}
        telephoneAnchorId="bid-onsite-hub"
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link", { name: /plan visit/i })).not.toBeInTheDocument();
  });
});
