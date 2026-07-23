import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LotAuctionTypePill } from "./lot-auction-type-pill.js";

describe("LotAuctionTypePill", () => {
  it("renders english with info shell and gavel icon", () => {
    const { container } = render(<LotAuctionTypePill mode="english" label="English" />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toMatch(/bg-info-container/);
    expect(shell.className).toMatch(/text-info/);
    expect(shell.querySelector("svg")).not.toBeNull();
    expect(shell.textContent).toContain("English");
  });

  it("renders dutch with warning shell", () => {
    const { container } = render(<LotAuctionTypePill mode="dutch" label="Dutch" />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toMatch(/bg-warning-container/);
    expect(shell.className).toMatch(/text-warning/);
    expect(shell.querySelector("svg")).not.toBeNull();
  });

  it("renders sealed with secondary shell", () => {
    const { container } = render(<LotAuctionTypePill mode="sealed" label="Sealed bid" />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toMatch(/bg-secondary-container/);
    expect(shell.className).toMatch(/text-on-secondary-container/);
    expect(shell.className).toMatch(/whitespace-nowrap/);
    expect(shell.querySelector("svg")).not.toBeNull();
  });

  it("renders buy_it_now with success shell and tag icon", () => {
    const { container } = render(<LotAuctionTypePill mode="buy_it_now" label="Buy it now" />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toMatch(/bg-success-container/);
    expect(shell.className).toMatch(/text-success/);
    expect(shell.querySelector("svg.lucide-tag")).not.toBeNull();
  });

  it("iconOnly renders glyph without pill shell or visible label", () => {
    const { container } = render(<LotAuctionTypePill mode="english" label="English" iconOnly />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).not.toMatch(/bg-info-container/);
    expect(shell.textContent).toBe("");
    expect(shell.querySelector("svg")).not.toBeNull();
  });

  it("iconOnly sets aria-label and title from string label", () => {
    const { container } = render(<LotAuctionTypePill mode="dutch" label="Dutch" iconOnly />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.getAttribute("role")).toBe("img");
    expect(shell.getAttribute("aria-label")).toBe("Dutch");
    expect(shell.getAttribute("title")).toBe("Dutch");
  });
});
