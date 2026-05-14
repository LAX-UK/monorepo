import { DashboardSection } from "@/components/dashboard/primitives/dashboard-section";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("DashboardSection", () => {
  it("associates heading with section when id is set", () => {
    render(
      <DashboardSection id="sec-test" title="Section title" description="Desc">
        <p>Child</p>
      </DashboardSection>,
    );
    const section = document.getElementById("sec-test");
    expect(section).toBeInstanceOf(HTMLElement);
    expect(section?.tagName.toLowerCase()).toBe("section");
    expect(screen.getByRole("heading", { name: "Section title" })).toHaveAttribute(
      "id",
      "sec-test-heading",
    );
    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});
