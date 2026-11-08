import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => ({ pending: false }));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    scroll: _scroll,
    ...rest
  }: { href: string; children: React.ReactNode; scroll?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLinkStatus: () => status,
}));

const { MarketingFilterLinkRow } = await import("./marketing-filter-link-row.js");

afterEach(() => {
  cleanup();
  status.pending = false;
});

describe("MarketingFilterLinkRow pending", () => {
  it("answers a tap at once: while the navigation is under way the row is dimmed and busy", () => {
    status.pending = true;
    const { container } = render(
      <MarketingFilterLinkRow kind="checkbox" label="Oil" href="/?medium=oil" checked={false} />,
    );
    const body = container.querySelector("[data-pending]");
    expect(body).toHaveAttribute("aria-busy", "true");
    expect(body?.className).toContain("opacity-60");
  });

  it("is plain when nothing is loading", () => {
    const { container } = render(
      <MarketingFilterLinkRow kind="checkbox" label="Oil" href="/?medium=oil" checked={false} />,
    );
    expect(container.querySelector("[data-pending]")).toBeNull();
    expect(container.querySelector("[aria-busy]")).toBeNull();
  });
});

describe("MarketingFilterLinkRow keyboard", () => {
  it("chooses a checkbox with Space, as a real checkbox does, without scrolling the page", () => {
    render(
      <MarketingFilterLinkRow kind="checkbox" label="Oil" href="/?medium=oil" checked={false} />,
    );
    const row = screen.getByRole("checkbox", { name: "Oil" });
    const clicked = vi.fn((event: Event) => event.preventDefault());
    row.addEventListener("click", clicked);
    const notCancelled = fireEvent.keyDown(row, { key: " " });
    expect(notCancelled).toBe(false);
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("leaves other keys alone", () => {
    render(
      <MarketingFilterLinkRow kind="checkbox" label="Oil" href="/?medium=oil" checked={false} />,
    );
    const row = screen.getByRole("checkbox", { name: "Oil" });
    const clicked = vi.fn();
    row.addEventListener("click", clicked);
    expect(fireEvent.keyDown(row, { key: "ArrowDown" })).toBe(true);
    expect(clicked).not.toHaveBeenCalled();
  });

  it("makes a choice of one a plain link marked current, so Tab and Enter work as on any link", () => {
    render(
      <>
        <MarketingFilterLinkRow kind="radio" label="A–Z" href="/artists" checked />
        <MarketingFilterLinkRow
          kind="radio"
          label="Most lots"
          href="/artists?sort=popular"
          checked={false}
        />
      </>,
    );
    expect(screen.queryByRole("radio")).toBeNull();
    const chosen = screen.getByRole("link", { name: "A–Z" });
    expect(chosen).toHaveAttribute("aria-current", "true");
    const other = screen.getByRole("link", { name: "Most lots" });
    expect(other).not.toHaveAttribute("aria-current");
    expect(other).toHaveAttribute("href", "/artists?sort=popular");
    expect(other).not.toHaveAttribute("tabindex");
  });
});
