import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SaleDetailMetaRow } from "./sale-detail-meta-row";

describe("SaleDetailMetaRow", () => {
  it("renders lots and registrations alongside schedule", () => {
    render(
      <SaleDetailMetaRow
        sale={
          {
            id: "sale-1",
            title: "Modern Sale",
            locationCity: "London",
            startTime: new Date("2026-06-01T10:00:00Z"),
            endTime: new Date("2026-06-01T18:00:00Z"),
          } as never
        }
        lotCount={24}
        registrationCount={8}
      />,
    );

    expect(screen.getByText(/London/)).toBeTruthy();
    expect(screen.getByText(/24 lots/)).toBeTruthy();
    expect(screen.getByText(/8 registrations/)).toBeTruthy();
  });
});
