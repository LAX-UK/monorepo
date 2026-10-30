import type { NeedsYouRowView } from "@/lib/organisation-home/needs-you-view";
import type { DashboardTileView } from "@/lib/organisation-home/organisation-dashboard-view";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeActivity } from "./home-activity";
import { HomeAtAGlance } from "./home-at-a-glance";
import { HomeConsignmentStages } from "./home-consignment-stages";
import { HomeFirstRun } from "./home-first-run";
import { HomeFirstSteps } from "./home-first-steps";
import { HomeNeedsYou, NEEDS_YOU_VISIBLE } from "./home-needs-you";
import { HomeShortcuts } from "./home-shortcuts";
import { HomeUpcomingSales } from "./home-upcoming-sales";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function row(key: string, overrides: Partial<NeedsYouRowView> = {}): NeedsYouRowView {
  return {
    key,
    topic: "purchase",
    title: `Task ${key}`,
    detail: "Detail",
    due: null,
    action: { label: `Do ${key}`, href: `/${key}` },
    section: "purchases",
    items: 1,
    ...overrides,
  };
}

describe("HomeNeedsYou", () => {
  it("is one calm line when nothing needs the member, never an empty card", () => {
    render(<HomeNeedsYou rows={[]} failed={false} notices={[]} />);
    expect(screen.getByText("Nothing needs you right now.")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Needs you" })).toBeNull();
  });

  it("gives each task one button and its date as a badge", () => {
    render(
      <HomeNeedsYou
        failed={false}
        notices={[]}
        rows={[
          row("outbid", {
            topic: "bid",
            title: "Outbid on “Sun over Arles”",
            due: {
              text: "Closes 30 Oct, 18:12",
              tone: "warning",
              dateTime: "2026-10-30T18:12:00Z",
            },
            action: { label: "Bid again", href: "/lot/sun-over-arles/l88" },
          }),
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Needs you" });
    expect(within(list).getAllByRole("link")).toHaveLength(1);
    expect(within(list).getByRole("link", { name: "Bid again" })).toHaveAttribute(
      "href",
      "/lot/sun-over-arles/l88",
    );
    expect(within(list).getAllByText("Closes 30 Oct, 18:12")[0]?.tagName).toBe("TIME");
  });

  it("shows five tasks and the rest behind View all, never cut silently", () => {
    const rows = Array.from({ length: 7 }, (_, i) => row(`t${i}`));
    render(<HomeNeedsYou rows={rows} failed={false} notices={[]} />);
    const list = screen.getByRole("list", { name: "Needs you" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(NEEDS_YOU_VISIBLE);
    fireEvent.click(screen.getByRole("button", { name: "View all 7" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(7);
  });

  it("says the list could not load and offers to try again", () => {
    render(<HomeNeedsYou rows={[]} failed notices={[]} />);
    expect(screen.queryByText("Nothing needs you right now.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("explains how the list is ordered", () => {
    render(<HomeNeedsYou rows={[row("a")]} failed={false} notices={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "How this list works" }));
    expect(screen.getByRole("dialog", { name: "How this list works" })).toBeVisible();
  });
});

describe("HomeFirstSteps", () => {
  it("shows progress, and the one primary action on the step to take now", () => {
    render(
      <HomeFirstSteps
        firstSteps={{
          done: 1,
          steps: [
            {
              id: "documents",
              state: "done",
              title: "Send documents",
              detail: "Done",
              action: null,
            },
            {
              id: "payouts",
              state: "next",
              title: "Set up payouts",
              detail: "About 5 minutes.",
              action: { label: "Set up payouts", href: "/organisation/payouts", primary: true },
            },
            {
              id: "invite",
              state: "later",
              title: "Invite your team",
              detail: "Colleagues",
              action: { label: "Invite a member", href: "/team", primary: false },
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("1 of 3 done")).toBeVisible();
    expect(screen.getByTestId("home-step-payouts")).toHaveAttribute("data-state", "next");
    expect(screen.getByRole("link", { name: "Set up payouts" })).toHaveAttribute(
      "href",
      "/organisation/payouts",
    );
    expect(screen.getByText("Done:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invite a member" })).toHaveAttribute("href", "/team");
  });
});

describe("HomeAtAGlance", () => {
  const tile = (overrides: Partial<DashboardTileView>): DashboardTileView => ({
    id: "sold_this_year",
    label: "Sold this year",
    figures: ["£48,200.00"],
    emptyText: null,
    supporting: ["5 works since 1 Jan"],
    description: "Hammer prices of works sold this year.",
    href: "/selling/consignments?tab=sold",
    ...overrides,
  });

  it("links each figure to its page and says an empty one in words, never £0", () => {
    render(
      <HomeAtAGlance
        tiles={[
          tile({}),
          tile({
            id: "open_bids",
            label: "Open bids",
            figures: [],
            emptyText: "No open bids",
            supporting: [],
            href: "/bids",
          }),
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Sold this year: £48,200.00/ })).toHaveAttribute(
      "href",
      "/selling/consignments?tab=sold",
    );
    expect(screen.getByText("No open bids")).toBeVisible();
    expect(screen.queryByText("£0.00")).toBeNull();
  });

  it("is left out with no figures", () => {
    const { container } = render(<HomeAtAGlance tiles={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the columns", () => {
  it("lists upcoming sales as cards with how many of the organisation's works", () => {
    render(
      <HomeUpcomingSales
        seeAllHref="/selling/consignments?tab=in-sale"
        sales={[
          {
            id: "s1",
            title: "Modern British",
            date: "20 Nov 2026",
            dateTime: "2026-11-20T10:00:00.000Z",
            works: "4 of your works",
            href: "/sales/modern-british/s1",
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Modern British/ })).toHaveAttribute(
      "href",
      "/sales/modern-british/s1",
    );
    expect(screen.getByRole("link", { name: "All sales" })).toBeVisible();
  });

  it("reads each stage as its label, then its count", () => {
    render(
      <HomeConsignmentStages
        stages={[
          { id: "in_review", label: "In review", count: 2, href: "/a" },
          { id: "sold", label: "Sold", count: 23, href: "/b" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /^Sold\W+23$/ })).toHaveAttribute("href", "/b");
  });

  it("lists activity with how long ago and the full date on hover", () => {
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
    const time = within(screen.getByRole("list", { name: "Recent activity" })).getByText(
      "2 hours ago",
    );
    expect(time).toHaveAttribute("title", "29 Oct 2026, 09:00");
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/selling/consignments",
    );
  });

  it("leaves out empty activity and shortcuts", () => {
    const { container } = render(
      <>
        <HomeActivity activity={[]} seeAllHref={null} />
        <HomeShortcuts shortcuts={[]} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("HomeFirstRun", () => {
  const firstRun = {
    addressee: "organisation" as const,
    title: "Nothing yet",
    description: "Start here.",
    actions: [{ id: "sell" as const, label: "Sell a work", href: "/selling/new" }],
  };

  it("gives the people who run a new organisation a card for each first thing to do", () => {
    render(<HomeFirstRun firstRun={firstRun} organisationName="Cedar & Stone" payoutsPending />);
    expect(screen.getByRole("link", { name: /Sell a work/ })).toHaveAttribute(
      "href",
      "/selling/new",
    );
    expect(screen.getByText(/send it once payouts are set up/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Browse upcoming sales/ })).toHaveAttribute(
      "href",
      "/sales",
    );
  });

  it("gives any other member one calm empty state", () => {
    render(
      <HomeFirstRun
        firstRun={{ ...firstRun, addressee: "member", actions: [] }}
        organisationName="Cedar & Stone"
        payoutsPending={false}
      />,
    );
    expect(screen.getByRole("heading", { name: "Nothing yet" })).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
