import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it } from "vitest";
import { ButtonLink } from "./button-link.js";

function RouterLink({ href, children, ...props }: React.ComponentProps<"a">) {
  return (
    <a href={href} data-router-link="" {...props}>
      {children}
    </a>
  );
}

describe("ButtonLink", () => {
  it("is one link with the button's look, and a plain anchor by default", () => {
    render(
      <ButtonLink href="/selling/new" variant="primary">
        Sell a work
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Sell a work" });
    expect(link).toHaveAttribute("href", "/selling/new");
    expect(link.className).toContain("bg-lax-ink");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("uses the app's link component and passes anchor attributes through", () => {
    render(
      <ButtonLink href="https://maps.example" Link={RouterLink} target="_blank" rel="noopener">
        Open map
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Open map" });
    expect(link).toHaveAttribute("data-router-link");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
