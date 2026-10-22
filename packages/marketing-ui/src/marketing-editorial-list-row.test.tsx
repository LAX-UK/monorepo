import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingEditorialListRow } from "./marketing-editorial-list-row.js";

describe("MarketingEditorialListRow", () => {
  it("links the headline and shows kicker and date", () => {
    render(
      <MarketingEditorialListRow
        kicker="Design Week"
        title="Innovations in sustainability"
        meta="20 September 2026"
        href="/stories/innovations"
      />,
    );
    expect(screen.getByRole("link", { name: "Innovations in sustainability" })).toHaveAttribute(
      "href",
      "/stories/innovations",
    );
    expect(screen.getByText("Design Week")).toBeInTheDocument();
    expect(screen.getByText("20 September 2026")).toBeInTheDocument();
  });

  it("omits kicker and date when absent and marks the inverse tone", () => {
    const { container } = render(
      <MarketingEditorialListRow title="Headline" href="/x" tone="inverse" />,
    );
    expect(container.querySelector("[data-tone='inverse']")).not.toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("routes the link through a custom link component", () => {
    render(
      <MarketingEditorialListRow
        title="Headline"
        href="/x"
        linkAs={({ href, children, className }) => (
          <a href={href} className={className} data-custom>
            {children}
          </a>
        )}
      />,
    );
    expect(screen.getByRole("link", { name: "Headline" })).toHaveAttribute("data-custom");
  });
});
