// @vitest-environment jsdom
import type { AdminRegisterLastCheck } from "@auction/shop-contracts";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListingCheckSection } from "./listing-check-section.client";

type Listing = AdminRegisterLastCheck["listing"];

const run: NonNullable<Listing["run"]> = {
  mode: "live",
  finishedAt: "2026-11-05T03:00:00.000Z",
  checked: 668,
  changed: 12,
  unchanged: 655,
  failed: 1,
  failures: [
    {
      registerId: "6f1c1d0e-0000-4000-8000-000000000001",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
      code: "product_not_found",
    },
  ],
};

describe("ListingCheckSection", () => {
  it("says no check has run yet before the first night", () => {
    render(<ListingCheckSection listing={{ run: null, failedDeliveries: 0 }} />);
    expect(screen.getByRole("heading", { name: "LAX listing in Zoho" })).toBeTruthy();
    expect(screen.getByText(/No listing check has run yet/)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the pass, and links each artwork it could not write to its record", () => {
    render(<ListingCheckSection listing={{ run, failedDeliveries: 0 }} />);
    const figures = screen.getByRole("region", { name: "LAX listing check" });
    expect(within(figures).getByText("Corrected")).toBeTruthy();
    expect(within(figures).getByText("668")).toBeTruthy();
    const link = screen.getByRole("link", { name: "LAX-ORI-PH-GAC-26-0001" });
    expect(link.getAttribute("href")).toBe("/from-zoho/6f1c1d0e-0000-4000-8000-000000000001");
    expect(screen.getByText("No longer in Zoho")).toBeTruthy();
  });

  it("says a dry run would correct, and points at writes that stopped after their retries", () => {
    render(
      <ListingCheckSection
        listing={{ run: { ...run, mode: "dry_run", failures: [], failed: 0 }, failedDeliveries: 2 }}
      />,
    );
    expect(screen.getByText("Would be corrected")).toBeTruthy();
    expect(screen.queryByText("Not written to Zoho")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain(
      "2 updates to Zoho stopped after their retries",
    );
  });
});
