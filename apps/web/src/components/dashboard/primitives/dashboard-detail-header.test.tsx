import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("DashboardDetailHeader", () => {
  it("omits visible header block on mobile when compact with no crumbs", () => {
    const { container } = render(
      <DashboardDetailHeader title="Acme Gallery" compactOnMobile badges={<span>Live</span>} />,
    );

    expect(container.querySelector("header")?.className).toMatch(/hidden lg:block/);
  });
});
