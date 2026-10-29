import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeActivity } from "./home-activity";
import { HomeCellGrid } from "./home-cell-grid";
import { HomeFirstRun } from "./home-first-run";
import { HomeNeedsYou } from "./home-needs-you";
import { HomeShortcuts } from "./home-shortcuts";

describe("HomeActivity", () => {
  it("is left out when there is nothing to list", () => {
    const { container } = render(<HomeActivity activity={[]} seeAllHref="/selling/consignments" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists rows with how long ago each happened and the full date on hover", () => {
    render(
      <HomeActivity
        seeAllHref="/selling/consignments"
        activity={[
          {
            key: "a",
            text: "“Harbour at Dusk” did not sell",
            href: null,
            when: "2 hours ago",
            fullDate: "29 Oct 2026, 09:00",
            at: "2026-10-29T09:00:00.000Z",
          },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Recent activity" });
    const time = within(list).getByText("2 hours ago");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-10-29T09:00:00.000Z");
    expect(time).toHaveAttribute("title", "29 Oct 2026, 09:00");
    expect(screen.getByRole("link", { name: /See all/ })).toHaveAttribute(
      "href",
      "/selling/consignments",
    );
  });
});

describe("HomeNeedsYou", () => {
  it("collapses to one calm line when nothing needs the member", () => {
    render(<HomeNeedsYou tasks={[]} />);
    expect(screen.getByTestId("home-needs-you-empty")).toHaveTextContent(
      "Nothing needs you right now.",
    );
    expect(screen.queryByRole("heading", { name: "Needs you" })).toBeNull();
  });

  it("lists each task with one button, the first one primary", () => {
    render(
      <HomeNeedsYou
        tasks={[
          {
            key: "payouts",
            title: "Set up payouts",
            detail: "Needed before the organisation's lots can go live in a sale.",
            action: { label: "Set up", href: "/organisation/payouts" },
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Needs you" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Set up" })).toHaveAttribute(
      "href",
      "/organisation/payouts",
    );
  });
});

describe("HomeShortcuts", () => {
  it("is left out for roles the domain gives none (everyone but owners and admins)", () => {
    const { container } = render(<HomeShortcuts shortcuts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("HomeFirstRun", () => {
  it("gives the people who run a new organisation the full first steps", () => {
    const { container } = render(
      <HomeFirstRun
        firstRun={{
          addressee: "organisation",
          title: "Get Northbank Gallery started",
          description: "Send a first work to our specialists.",
          actions: [{ id: "sell", label: "Sell a work", href: "/selling/new" }],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Get Northbank Gallery started" })).toBeVisible();
    expect(container.querySelector("svg")?.closest("div")?.className).not.toContain("w-20");
  });

  it("keeps a member's own empty Home quiet, with no large drawing", () => {
    const { container } = render(
      <HomeFirstRun
        firstRun={{
          addressee: "member",
          title: "Nothing to show yet",
          description: "Bids show here as they happen.",
          actions: [],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Nothing to show yet" })).toBeVisible();
    expect(container.innerHTML).toContain("w-20");
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("HomeCellGrid", () => {
  it("widens the last cell on phones so no row ends in a gap", () => {
    render(
      <HomeCellGrid
        labelledBy="x"
        items={["a", "b", "c"]}
        itemKey={(item) => item}
        phoneColumns={2}
        wideColumns={3}
        renderItem={(item) => <span>{item}</span>}
      />,
    );
    const cells = screen.getAllByRole("listitem");
    expect(cells[2]?.className).toContain("col-span-2");
    expect(cells[2]?.className).toContain("lg:col-span-1");
    expect(cells[0]?.className).not.toContain("col-span-2");
  });
});
