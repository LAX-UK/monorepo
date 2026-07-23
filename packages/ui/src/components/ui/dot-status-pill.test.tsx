import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DotStatusPill } from "./dot-status-pill.js";

describe("DotStatusPill", () => {
  it("renders multi-word label on a single-line shell", () => {
    const { container } = render(<DotStatusPill label="Under review" tone="warning" />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.textContent).toContain("Under review");
    expect(shell.className).toMatch(/whitespace-nowrap/);
    expect(shell.className).toMatch(/shrink-0/);
  });

  it("renders live tone with danger shell and radio icon", () => {
    const { container } = render(<DotStatusPill label="Live" tone="live" />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toMatch(/bg-danger-container/);
    expect(shell.querySelector("svg.lucide-radio")).not.toBeNull();
  });

  it("renders critical tone with ban icon", () => {
    const { container } = render(<DotStatusPill label="Rejected" tone="critical" />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toMatch(/bg-danger-container/);
    expect(shell.querySelector("svg.lucide-ban")).not.toBeNull();
  });

  it("iconOnly renders glyph without pill shell or visible label", () => {
    const { container } = render(<DotStatusPill label="Live" tone="live" iconOnly />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).not.toMatch(/bg-danger-container/);
    expect(shell.textContent).toBe("");
    expect(shell.querySelector("svg")).not.toBeNull();
  });

  it("iconOnly sets aria-label and title from string label", () => {
    const { container } = render(<DotStatusPill label="Live" tone="live" iconOnly />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.getAttribute("role")).toBe("img");
    expect(shell.getAttribute("aria-label")).toBe("Live");
    expect(shell.getAttribute("title")).toBe("Live");
  });
});
