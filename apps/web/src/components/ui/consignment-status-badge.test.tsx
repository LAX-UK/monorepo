import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConsignmentStatusBadge } from "./consignment-status-badge";

describe("ConsignmentStatusBadge", () => {
  it("reads Unsold, then follows the request and the confirmation", () => {
    const { rerender } = render(<ConsignmentStatusBadge stage="unsold" />);
    expect(screen.getByText("Unsold")).toBeTruthy();
    rerender(<ConsignmentStatusBadge stage="relist_requested" />);
    expect(screen.getByText("Relist requested")).toBeTruthy();
    rerender(<ConsignmentStatusBadge stage="relist_confirmed" />);
    expect(screen.getByText("Relist confirmed")).toBeTruthy();
  });

  it("keeps the submission status before the sale", () => {
    render(<ConsignmentStatusBadge stage="under_review" />);
    expect(screen.getByText("Under review")).toBeTruthy();
  });
});
