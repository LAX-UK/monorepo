import { DashboardListRowCard } from "@/components/dashboard/primitives/dashboard-list-row-card";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("DashboardListRowCard", () => {
  it("renders title, subtitle, badges, and footer slots", () => {
    render(
      <DashboardListRowCard
        title={<a href="/lot/1">Blue Canvas</a>}
        subtitle={<p>Artist name</p>}
        badges={<span>Live</span>}
        footer={<button type="button">Action</button>}
      />,
    );

    expect(screen.getByRole("link", { name: "Blue Canvas" })).toBeInTheDocument();
    expect(screen.getByText("Artist name")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });
});
