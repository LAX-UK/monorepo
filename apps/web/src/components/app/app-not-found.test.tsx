import { AppNotFound } from "@/components/app/app-not-found";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("AppNotFound", () => {
  it("renders title, illustration, and search recovery link", () => {
    render(
      <AppNotFound
        title="Page missing"
        description="Try another route."
        searchHref="/search"
        searchLabel="Search catalogue"
        illustration="notFound"
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Page missing" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Search catalogue" })).toHaveAttribute(
      "href",
      "/search",
    );
    expect(document.querySelector("svg[aria-hidden]")).toBeTruthy();
  });

  it("applies fixed site header offset when siteHeaderOffset is set", () => {
    const { container } = render(
      <AppNotFound title="Page missing" description="Try another route." siteHeaderOffset />,
    );

    const section = container.querySelector("section");
    expect(section?.className).toContain("pt-[var(--header-height)]");
    expect(section?.className).toContain("min-h-[calc(100dvh-var(--header-height))]");
  });
});
