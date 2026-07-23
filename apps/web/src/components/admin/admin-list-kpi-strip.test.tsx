import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("AdminListKpiStrip", () => {
  it("renders six KPI tiles in a six-column layout", () => {
    render(
      <AdminListKpiStrip
        tiles={Array.from({ length: 6 }, (_, index) => ({
          label: `Metric ${index + 1}`,
          value: String(index + 1),
        }))}
      />,
    );

    expect(screen.getByText("Metric 1")).toBeTruthy();
    expect(screen.getByText("Metric 6")).toBeTruthy();
  });
});
