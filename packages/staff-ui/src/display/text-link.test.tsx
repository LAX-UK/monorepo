import type { LinkComponent } from "@auction/ui/lax";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextLink } from "./text-link.js";

const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <a href={href} data-router="" {...rest}>
    {children}
  </a>
);

describe("TextLink", () => {
  it("opens another site in a new tab and says so", () => {
    render(
      <TextLink href="https://lax.art/artworks/night-garden" external>
        View on lax.art
      </TextLink>,
    );
    const link = screen.getByRole("link", { name: "View on lax.art (opens in a new tab)" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.querySelector("svg")).not.toBeNull();
    expect(link.className).toContain("underline");
  });

  it("uses the app's router link for in-app pages, without the external icon", () => {
    render(
      <TextLink href="/artworks/1" Link={RouterLink}>
        Night Garden
      </TextLink>,
    );
    const link = screen.getByRole("link", { name: "Night Garden" });
    expect(link).toHaveAttribute("data-router");
    expect(link).not.toHaveAttribute("target");
    expect(link.querySelector("svg")).toBeNull();
  });

  it("renders a plain link for mail and phone", () => {
    render(<TextLink href="mailto:grace@hopper.dev">grace@hopper.dev</TextLink>);
    expect(screen.getByRole("link", { name: "grace@hopper.dev" })).toHaveAttribute(
      "href",
      "mailto:grace@hopper.dev",
    );
  });
});
