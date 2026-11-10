import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordList, RecordRow, RecordRowMedia } from "./record-row.js";

function row(ui: React.ReactElement) {
  render(<RecordList aria-label="Records">{ui}</RecordList>);
  return screen.getByRole("listitem");
}

describe("RecordRow", () => {
  it("lays out by the width of its list, not the window", () => {
    render(
      <RecordList aria-label="Consignments">
        <RecordRow title="Untitled" />
      </RecordList>,
    );
    const list = screen.getByRole("list", { name: "Consignments" });
    expect(list.className).toContain("@container");
  });

  it("opens the record from a title link that covers the whole row", () => {
    const li = row(<RecordRow title="Blue horizon" href="/selling/consignments/1" />);
    const link = within(li).getByRole("link", { name: "Blue horizon" });
    expect(link).toHaveAttribute("href", "/selling/consignments/1");
    expect(link.className).toContain("after:absolute");
    expect(link.className).toContain("after:inset-0");
    // The row draws the focus ring for its link, inside its own edge.
    expect(li.className).toContain("has-[[data-record-link]:focus-visible]:outline-2");
  });

  it("uses the link component it is given", () => {
    function AppLink(props: { href: string; className?: string; children?: React.ReactNode }) {
      return <a {...props} data-app-link />;
    }
    const li = row(<RecordRow title="Lot 4" href="/lots/4" linkAs={AppLink} />);
    expect(within(li).getByRole("link")).toHaveAttribute("data-app-link");
  });

  it("is static without an href", () => {
    const li = row(<RecordRow title="Payout, March 2026" />);
    expect(within(li).queryByRole("link")).toBeNull();
    expect(li.className).not.toContain("hover:");
  });

  it("puts a silent dot between the facts, dropping empty ones", () => {
    const li = row(<RecordRow title="Work" meta={["Lot 12", null, "", "Spring sale", false]} />);
    const meta = li.querySelector("[data-record-meta]") as HTMLElement;
    const facts = [...meta.querySelectorAll("[data-record-fact]")];
    expect(facts.map((fact) => fact.textContent)).toEqual(["Lot 12", "Spring sale"]);
    // The dot is drawn in front of each fact with empty alternative text, so readers skip it.
    for (const fact of facts) expect(fact.className).toContain("before:content-['·'_/_'']");
  });

  it("starts each wrapped line with a fact, not a dot", () => {
    const li = row(<RecordRow title="Work" meta={["Lot 12", "Spring sale"]} />);
    const meta = li.querySelector("[data-record-meta]") as HTMLElement;
    // The line is shifted left by one dot's width and clipped, hiding the dot that opens it.
    expect(meta.className).toContain("overflow-hidden");
    expect((meta.firstElementChild as HTMLElement).className).toContain("-ml-4");
    expect((meta.querySelector("[data-record-fact]") as HTMLElement).className).toContain(
      "before:w-4",
    );
  });

  it("keeps facts on one line when wide, truncating only the named fact, in tabular figures", () => {
    const long = "The Annual Spring Sale of Modern and Post-War British Art and Design, Part Two";
    const li = row(
      <RecordRow title="Work" meta={["Lot 12", long, null, "Max £1,200"]} metaShrink={1} />,
    );
    const meta = li.querySelector("[data-record-meta]") as HTMLElement;
    expect(meta.className).toContain("tabular-nums");
    expect((meta.firstElementChild as HTMLElement).className).toContain("@2xl:flex-nowrap");
    const facts = [...meta.querySelectorAll<HTMLElement>("[data-record-fact]")];
    expect(facts.map((f) => f.className.includes("@2xl:shrink-0"))).toEqual([true, false, true]);
    // The long name still truncates, and every fact keeps its separator dot.
    expect(facts[1]?.textContent).toBe(long);
    expect(facts[1]?.firstElementChild?.className).toContain("truncate");
    for (const fact of facts) expect(fact.className).toContain("before:content-['·'_/_'']");
  });

  it("wraps facts at every width without metaShrink", () => {
    const li = row(<RecordRow title="Work" meta={["Lot 12", "Spring sale"]} />);
    const meta = li.querySelector("[data-record-meta]") as HTMLElement;
    expect(meta.className).not.toContain("tabular-nums");
    expect((meta.firstElementChild as HTMLElement).className).not.toContain("flex-nowrap");
  });

  it("draws no facts line when there are none", () => {
    const li = row(<RecordRow title="Work" meta={[null]} />);
    expect(li.querySelector("[data-record-meta]")).toBeNull();
  });

  it("keeps its controls above the row link so they stay clickable", () => {
    const li = row(
      <RecordRow
        title="Work"
        href="/w"
        action={<button type="button">Pay now</button>}
        menu={<button type="button">More</button>}
      />,
    );
    for (const name of ["Pay now", "More"]) {
      const wrapper = within(li).getByRole("button", { name }).parentElement as HTMLElement;
      expect(wrapper.className).toContain("relative");
      expect(wrapper.className).toContain("z-10");
    }
  });

  describe("in a narrow list", () => {
    it("lets the title and facts shrink and truncate instead of widening the row", () => {
      const li = row(
        <RecordRow
          title="A very long title that would otherwise push the row past the edge of the card"
          meta={["A long sale name that keeps going", "Lot 1200"]}
          status={<span>Needs changes</span>}
        />,
      );
      const body = li.querySelector("p")?.parentElement as HTMLElement;
      expect(body.className).toContain("min-w-0");
      expect(li.querySelector("p")?.className).toContain("truncate");
      const meta = li.querySelector("[data-record-meta]") as HTMLElement;
      expect(meta.firstElementChild?.className).toContain("flex-wrap");
      for (const fact of meta.querySelectorAll("[data-record-fact]")) {
        expect(fact.className).toContain("min-w-0");
        expect(fact.firstElementChild?.className).toContain("truncate");
      }
    });

    it("moves the status, figure and action under the title, wrapping as needed", () => {
      const li = row(
        <RecordRow
          title="Work"
          status={<span>Paid</span>}
          value="£4,200"
          action={<button type="button">Statement</button>}
        />,
      );
      const foot = li.querySelector("[data-record-foot]") as HTMLElement;
      // Stacked and wrapping by default; on one line only from the wide container size.
      expect(foot.className).toContain("flex-wrap");
      expect(foot.className).toContain("@2xl:flex-nowrap");
      expect(foot.parentElement?.className).toContain("flex-col");
      expect(foot.parentElement?.className).toContain("@2xl:flex-row");
      expect(foot).toHaveTextContent("£4,200");
    });

    it("draws no foot when there is nothing to put in it", () => {
      const li = row(<RecordRow title="Work" />);
      expect(li.querySelector("[data-record-foot]")).toBeNull();
    });
  });

  describe("needsYou", () => {
    const action = <button type="button">Bid £3,200.00</button>;

    it("shows an aligned row's action full width under its facts when narrow", () => {
      const li = row(<RecordRow title="Work" aligned needsYou action={action} />);
      const slot = li.querySelector("[data-record-action]") as HTMLElement;
      expect(slot).toHaveAttribute("data-needs-you");
      // Not hidden on a narrow list, a line of its own, and the button fills it.
      expect(slot.className).not.toMatch(/(^|\s)hidden(\s|$)/);
      expect(slot.className).toContain("basis-full");
      expect(slot.className).toContain("[&>*]:w-full");
      // Wide, it returns to the aligned column.
      expect(slot.className).toContain("@2xl:w-40");
    });

    it("leaves the action out of a narrow row otherwise", () => {
      const li = row(<RecordRow title="Work" aligned action={action} />);
      const slot = li.querySelector("[data-record-action]") as HTMLElement;
      expect(slot).not.toHaveAttribute("data-needs-you");
      expect(slot.className).toMatch(/(^|\s)hidden(\s|$)/);
    });

    it("does nothing without an action", () => {
      const li = row(<RecordRow title="Work" aligned needsYou action={null} />);
      expect(li.querySelector("[data-needs-you]")).toBeNull();
    });
  });

  it("puts detail under the row: full width when narrow, under the title when wide", () => {
    const li = row(
      <RecordRow
        title="Work"
        leading={<RecordRowMedia>x</RecordRowMedia>}
        detail={<p>Step 2 of 4</p>}
      />,
    );
    const detail = li.querySelector("[data-record-detail]") as HTMLElement;
    expect(detail).toHaveTextContent("Step 2 of 4");
    expect(detail.parentElement).toBe(li);
    // 48px thumbnail plus the 16px gap of the wide row.
    expect(detail.className).toContain("@2xl:pl-16");
  });

  it("names each figure with its label, value first, before the status", () => {
    const li = row(
      <RecordRow
        title="Sun over Arles"
        figures={[
          { value: "£6,800", label: "current bid" },
          { value: "£6,200", label: "your maximum" },
        ]}
        status={<span data-testid="status">Outbid</span>}
      />,
    );
    const figures = li.querySelector("[data-record-figures]") as HTMLElement;
    expect(figures.tagName).toBe("DL");
    const terms = [...figures.querySelectorAll("dt")].map((dt) => dt.textContent);
    const values = [...figures.querySelectorAll("dd")].map((dd) => dd.textContent);
    expect(terms).toEqual(["current bid", "your maximum"]);
    expect(values).toEqual(["£6,800", "£6,200"]);
    // A narrow list shows the lead figure only; a wide one lines them all up in fixed cells.
    const [lead, second] = [...figures.children] as HTMLElement[];
    expect(lead?.className).not.toContain("hidden");
    expect(second?.className).toContain("hidden @2xl:flex");
    expect(lead?.className).toContain("@2xl:w-28");
    expect(
      figures.compareDocumentPosition(within(li).getByTestId("status")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("reads a date figure label first on a narrow list and value first on a wide one", () => {
    const li = row(
      <RecordRow
        title="Night harbour"
        figures={[{ value: "12 Nov", label: "choose by", labelFirst: true }]}
      />,
    );
    const term = li.querySelector("[data-record-figures] dt") as HTMLElement;
    const value = li.querySelector("[data-record-figures] dd") as HTMLElement;
    expect(term.className).toContain("order-1 @2xl:order-2");
    expect(value.className).toContain("order-2 @2xl:order-1");
  });

  it("says a missing figure in muted words, keeping its label for readers only", () => {
    const li = row(
      <RecordRow
        title="Downs after rain"
        figures={[{ value: "Estimate after review", label: "estimate", pending: true }]}
      />,
    );
    const term = li.querySelector("[data-record-figures] dt") as HTMLElement;
    const value = li.querySelector("[data-record-figures] dd") as HTMLElement;
    expect(term.className).toBe("sr-only");
    expect(value.className).toContain("text-on-surface-variant");
    expect(value.className).not.toContain("truncate");
  });

  it("gives the record link a target of at least 24px without moving the title", () => {
    const li = row(<RecordRow title="Ceramic vessel" href="/r/1" />);
    const link = li.querySelector("[data-record-link]") as HTMLElement;
    expect(link.className).toContain("block");
    expect(link.className).toContain("py-[3px]");
    expect(link.className).toContain("-my-[3px]");
  });

  it("keeps the status and action columns on an aligned row that has neither", () => {
    const li = row(
      <RecordRow
        title="Tidal study"
        figures={[{ value: "£1,450", label: "current bid" }]}
        action={null}
        aligned
      />,
    );
    const status = li.querySelector("[data-record-status]") as HTMLElement;
    const action = li.querySelector("[data-record-action]") as HTMLElement;
    // Hidden in a narrow list, a fixed column in a wide one.
    expect(status.className).toContain("hidden");
    expect(status.className).toContain("@2xl:w-40");
    expect(action.className).toContain("@2xl:w-40");
  });
});

describe("RecordRowMedia", () => {
  it("is a 48px square, hidden from readers, with a hairline inside its edge", () => {
    render(
      <RecordRowMedia>
        <img alt="" src="/a.jpg" />
      </RecordRowMedia>,
    );
    const media = document.querySelector("img")?.parentElement as HTMLElement;
    expect(media).toHaveAttribute("aria-hidden", "true");
    expect(media.className).toContain("size-12");
    expect(media.className).toContain("after:ring-inset");
  });
});

describe("RecordRow figure notes and narrow facts", () => {
  it("puts a note in the label's place and keeps the label for readers", () => {
    render(
      <RecordList aria-label="Bids">
        <RecordRow
          title="Lot"
          figures={[{ value: "Thu 12 Nov", label: "closes", note: "20:00 in Cairo" }]}
        />
      </RecordList>,
    );
    expect(screen.getByText("20:00 in Cairo")).toBeInTheDocument();
    expect(screen.getByText("closes").className).toContain("sr-only");
  });

  it("adds a fact that only a narrow row shows", () => {
    render(
      <RecordList aria-label="Bids">
        <RecordRow title="Lot" meta={["Lot 6"]} metaNarrow="20:00 in Cairo" />
      </RecordList>,
    );
    expect(screen.getByText("20:00 in Cairo").closest("[data-record-fact]")?.className).toContain(
      "@2xl:hidden",
    );
    expect(screen.getByText("Lot 6").closest("[data-record-fact]")?.className).not.toContain(
      "@2xl:hidden",
    );
  });

  it("makes a figure cell roomy only while the visitor's clock is away from London's", () => {
    render(
      <RecordList aria-label="Bids">
        <RecordRow
          title="Lot"
          figures={[{ value: "Thu 12 Nov", label: "closes", roomyWhenAway: true }]}
        />
      </RecordList>,
    );
    expect(screen.getByText("Thu 12 Nov").parentElement?.className).toContain(
      "[html.tz-away_&]:@2xl:w-36",
    );
  });
});
