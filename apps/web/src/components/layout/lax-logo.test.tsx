import { LaxLogo } from "@/components/layout/lax-logo";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("LaxLogo", () => {
  it("auth variant uses eager native img for svg", () => {
    render(<LaxLogo variant="auth" />);

    const img = screen.getByRole("img", { name: /London Auction House/i });
    expect(img).toHaveAttribute("src", "/logo.svg");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
  });

  it("header variant uses eager native img for svg", () => {
    render(<LaxLogo variant="header" />);

    const img = screen.getByRole("img", { name: /London Auction House/i });
    expect(img).toHaveAttribute("src", "/logo.svg");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
  });

  it("footer variant lazy-loads svg", () => {
    render(<LaxLogo variant="footer" />);

    const img = screen.getByRole("img", { name: /London Auction House/i });
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("fetchpriority", "auto");
  });
});
