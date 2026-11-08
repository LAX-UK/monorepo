import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Count,
  PlainLink as Link,
  SecondaryTabNav,
  SegmentedControl,
  TabNav,
  type TabNavItem,
} from "./index.js";

const pages: TabNavItem[] = [
  { id: "registrations", label: "Registrations", href: "/sales/1/registrations", count: 12 },
  {
    id: "telephone-bookings",
    label: "Telephone bookings",
    href: "/sales/1/telephone-bookings",
    count: 2,
    countTone: "attention",
    countLabel: "waiting",
  },
];

describe("SecondaryTabNav", () => {
  it("renders each page as a link in a named navigation, marking only the current one", () => {
    render(
      <SecondaryTabNav items={pages} activeId="telephone-bookings" label="Bidders" Link={Link} />,
    );
    const nav = screen.getByRole("navigation", { name: "Bidders" });
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/sales/1/registrations",
      "/sales/1/telephone-bookings",
    ]);
    expect(screen.getByRole("link", { name: /Telephone bookings/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /Registrations/ })).not.toHaveAttribute("aria-current");
  });

  it("shows each page's count, with work waiting in the attention tone and its meaning", () => {
    render(<SecondaryTabNav items={pages} activeId="registrations" label="Bidders" Link={Link} />);
    expect(screen.getByRole("link", { name: "Registrations 12" })).toBeInTheDocument();
    const waiting = screen.getByRole("link", { name: "Telephone bookings 2 waiting" });
    expect(waiting.querySelector(".bg-lax-ink")).not.toBeNull();
  });
});

describe("TabNav that scrolls", () => {
  it("keeps every tab in one row, never folding them into More", () => {
    render(
      <TabNav
        items={pages}
        activeId="registrations"
        label="Bidders"
        Link={Link}
        overflow="scroll"
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Bidders" });
    expect(nav.querySelectorAll("a")).toHaveLength(2);
    expect(nav.className).toContain("overflow-x-auto");
    expect(screen.queryByRole("button", { name: /More/ })).toBeNull();
  });
});

describe("Count", () => {
  it("reads its meaning after the number without showing it", () => {
    render(<Count value={3} tone="attention" label="waiting" />);
    const label = screen.getByText("waiting");
    expect(label).toHaveClass("sr-only");
    expect(label.parentElement).toHaveTextContent("3 waiting");
  });

  it("is drawn at 12px, the smallest text the workspace uses", () => {
    render(<Count value={3} label="waiting" />);
    expect(screen.getByText("waiting").parentElement).toHaveClass("text-lax-12");
  });
});

describe("TabNav for in-page links", () => {
  it("marks the section in view with aria-current=true and runs the item's click handler", () => {
    const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <TabNav
        label="Sale sections"
        Link={Link}
        activeId="lots"
        items={[
          { id: "about", label: "About", href: "#about", currentKind: "true" },
          { id: "lots", label: "Lots", href: "#lots", currentKind: "true", onClick },
        ]}
      />,
    );
    const lots = screen.getByRole("link", { name: "Lots" });
    expect(lots).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "About" })).not.toHaveAttribute("aria-current");
    fireEvent.click(lots);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "grid", label: "Grid" },
    { value: "list", label: "List" },
  ] as const;

  it("reports the chosen segment and ignores a click on the current one", () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        label="View"
        value="grid"
        onValueChange={onValueChange}
        options={options}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    expect(onValueChange).toHaveBeenCalledWith("list");
    onValueChange.mockClear();
    fireEvent.click(screen.getByRole("radio", { name: "Grid" }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("can be disabled while a change is pending", () => {
    render(
      <SegmentedControl
        label="View"
        value="grid"
        onValueChange={() => {}}
        options={options}
        disabled
      />,
    );
    expect(screen.getByRole("radio", { name: "List" })).toBeDisabled();
  });
});

describe("TabNav that folds into More", () => {
  const sections: TabNavItem[] = [
    { id: "new", label: "New from Zoho", href: "/z", count: 3 },
    { id: "decisions", label: "Needs a decision", href: "/z?tab=decisions", count: 1 },
    { id: "all", label: "All artworks", href: "/z?tab=all" },
  ];
  const TAB_WIDTH = 140;
  const MORE_WIDTH = 80;

  /** jsdom has no layout, so the widths the kit measures are stood in for here. */
  function withLayout(navWidth: number, run: () => void) {
    const offset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
    const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return this.textContent?.startsWith("More") ? MORE_WIDTH : TAB_WIDTH;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return this.tagName === "NAV" ? navWidth : 0;
      },
    });
    try {
      run();
    } finally {
      if (offset) Object.defineProperty(HTMLElement.prototype, "offsetWidth", offset);
      if (client) Object.defineProperty(HTMLElement.prototype, "clientWidth", client);
    }
  }

  const tabLink = (name: RegExp) => screen.getByRole("link", { name });

  it("lets the only tab that fits give way, so neither it nor More is clipped", () => {
    // Room for More and part of one tab: the current tab stays, and shrinks with an ellipsis.
    withLayout(150, () => {
      render(<TabNav items={sections} activeId="new" label="Views" Link={Link} />);
      const link = tabLink(/New from Zoho/);
      expect(link).toHaveClass("min-w-0");
      expect(link).not.toHaveClass("shrink-0");
      expect(link.closest("li")).toHaveClass("min-w-0");
      expect(link.querySelector("span")).toHaveClass("truncate");
      // More keeps its full width and says how many tabs it holds.
      const more = screen.getByRole("button", { name: "More views, 2" });
      expect(more.closest("li")).toHaveClass("shrink-0");
      expect(screen.queryByRole("link", { name: /Needs a decision/ })).toBeNull();
    });
  });

  it("keeps every tab at full width while more than one fits", () => {
    withLayout(400, () => {
      render(<TabNav items={sections} activeId="new" label="Views" Link={Link} />);
      for (const name of [/New from Zoho/, /Needs a decision/]) {
        expect(tabLink(name)).toHaveClass("shrink-0");
        expect(tabLink(name).closest("li")).toHaveClass("shrink-0");
      }
      expect(screen.getByRole("button", { name: "More views, 1" })).toBeInTheDocument();
    });
  });

  it("shows no More at all when every tab fits", () => {
    withLayout(900, () => {
      render(<TabNav items={sections} activeId="new" label="Views" Link={Link} />);
      expect(screen.queryByRole("button", { name: /^More/ })).toBeNull();
      expect(screen.getAllByRole("link")).toHaveLength(3);
    });
  });
});
