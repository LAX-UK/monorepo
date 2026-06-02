import { LaxLogo } from "@/components/layout/lax-logo";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("LaxLogo", () => {
  it("auth variant uses eager native img for svg", () => {
    render(<LaxLogo variant="auth" />);

    const imgs = screen.getAllByRole("img", { name: /London Auction House/i });
    const dark = imgs.find((img) => img.getAttribute("src") === "/logo.svg");
    expect(dark).toBeDefined();
    expect(dark).toHaveAttribute("loading", "eager");
    expect(dark).toHaveAttribute("fetchpriority", "high");
    expect(dark).toHaveClass("lax-logo-img");
  });

  it("header variant uses eager native img for svg with light companion", () => {
    render(<LaxLogo variant="header" />);

    const imgs = screen.getAllByRole("img", { name: /London Auction House/i });
    expect(imgs).toHaveLength(2);
    expect(imgs.some((img) => img.getAttribute("src") === "/logo.svg")).toBe(true);
    expect(imgs.some((img) => img.getAttribute("src") === "/logo-light.svg")).toBe(true);
    for (const img of imgs) {
      expect(img).toHaveAttribute("loading", "eager");
      expect(img).toHaveAttribute("fetchpriority", "high");
      expect(img).toHaveClass("lax-logo-img");
    }
  });

  it("footer variant lazy-loads svg", () => {
    render(<LaxLogo variant="footer" />);

    const imgs = screen.getAllByRole("img", { name: /London Auction House/i });
    for (const img of imgs) {
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).toHaveAttribute("fetchpriority", "auto");
      expect(img).toHaveClass("lax-logo-img");
    }
  });

  it("on-dark surface shows light asset and hides dark asset", () => {
    render(<LaxLogo variant="header" surfaceTone="on-dark" />);

    const imgs = screen.getAllByRole("img", { hidden: true, name: /London Auction House/i });
    const darkImg = imgs.find((img) => img.getAttribute("src") === "/logo.svg");
    const lightImg = imgs.find((img) => img.getAttribute("src") === "/logo-light.svg");
    expect(darkImg).toHaveClass("hidden");
    expect(lightImg).toHaveClass("block");
  });
});
