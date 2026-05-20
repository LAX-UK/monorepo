import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminStatusBadge } from "./admin-status-badge";

describe("AdminStatusBadge", () => {
  it("renders sale status label", () => {
    render(<AdminStatusBadge domain="sale" status="active" />);
    expect(screen.getByText("Live")).toBeTruthy();
  });

  it("renders payout status", () => {
    render(<AdminStatusBadge domain="payout" status="paid" />);
    expect(screen.getByText("Paid")).toBeTruthy();
  });
});
