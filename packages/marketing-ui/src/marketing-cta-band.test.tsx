import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingCtaBand } from "./marketing-cta-band.js";

describe("MarketingCtaBand", () => {
  it("renders title, body and action on the tone surface by default", () => {
    const { container } = render(
      <MarketingCtaBand
        title="Take the conversation further"
        body="Talk to us"
        action={<a href="/contact">Contact</a>}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Take the conversation further" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Contact" })).toBeVisible();
    expect(container.querySelector("section")?.className).toContain("bg-surface");
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });

  it("layers media and a scrim behind the copy when media is given", () => {
    const { container } = render(
      <MarketingCtaBand title="Curious to learn more?" media={<img src="/bg.jpg" alt="" />} />,
    );
    const section = container.querySelector("section");
    expect(section?.className).toContain("isolate");
    expect(section?.className).not.toContain("bg-surface");
    expect(container.querySelector("img")).not.toBeNull();
    expect(container.querySelector("[aria-hidden]")).not.toBeNull();
  });
});
