import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeliveryModePill } from "./delivery-mode-pill.js";

describe("DeliveryModePill", () => {
  it("renders online with info shell and laptop icon", () => {
    const { container } = render(<DeliveryModePill mode="online" label="Online" />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toMatch(/bg-info-container/);
    expect(shell.className).toMatch(/text-info/);
    expect(shell.querySelector("svg.lucide-laptop")).not.toBeNull();
    expect(shell.textContent).toContain("Online");
  });

  it("renders onsite with warning shell and map pin icon", () => {
    const { container } = render(<DeliveryModePill mode="onsite" label="Onsite" />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toMatch(/bg-warning-container/);
    expect(shell.className).toMatch(/text-warning/);
    expect(shell.querySelector("svg")).not.toBeNull();
  });

  it("renders hybrid with secondary shell and monitor-smartphone icon", () => {
    const { container } = render(<DeliveryModePill mode="hybrid" label="Hybrid" />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toMatch(/bg-secondary-container/);
    expect(shell.className).toMatch(/text-on-secondary-container/);
    expect(shell.querySelector("svg.lucide-monitor-smartphone")).not.toBeNull();
    expect(shell.querySelector("svg.lucide-laptop")).toBeNull();
  });

  it("iconOnly renders glyph without pill shell or visible label", () => {
    const { container } = render(<DeliveryModePill mode="online" label="Online" iconOnly />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).not.toMatch(/bg-info-container/);
    expect(shell.textContent).toBe("");
    expect(shell.querySelector("svg")).not.toBeNull();
  });

  it("iconOnly sets aria-label and title from string label", () => {
    const { container } = render(<DeliveryModePill mode="online" label="Online" iconOnly />);
    const shell = container.firstChild as HTMLElement;
    expect(shell.getAttribute("role")).toBe("img");
    expect(shell.getAttribute("aria-label")).toBe("Online");
    expect(shell.getAttribute("title")).toBe("Online");
  });
});
