import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminStatusBadge } from "./admin-status-badge";

describe("AdminStatusBadge", () => {
  it("renders sale status label with Tag-Review chip", () => {
    const { container } = render(<AdminStatusBadge domain="sale" status="active" />);
    expect(screen.getByText("Live")).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders payout status with success shell", () => {
    const { container } = render(<AdminStatusBadge domain="payout" status="paid" />);
    const shell = container.firstChild as HTMLElement;
    expect(screen.getByText("Paid")).toBeTruthy();
    expect(shell.className).toMatch(/bg-success-container/);
  });

  it("renders cancelled sale as critical danger chip", () => {
    const { container } = render(<AdminStatusBadge domain="sale" status="cancelled" />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toMatch(/text-danger/);
  });
});
