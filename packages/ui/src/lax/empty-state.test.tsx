import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./index.js";

describe("EmptyState", () => {
  it("renders an inline state with an h2 by default", () => {
    render(<EmptyState illustration="frame" title="Nothing yet" description="Come back soon." />);
    expect(screen.getByRole("heading", { level: 2, name: "Nothing yet" })).toBeInTheDocument();
  });

  it("uses the heading level it is given inline", () => {
    render(
      <EmptyState illustration="frame" title="Nothing" description="Soon." headingLevel="h3" />,
    );
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("is the page's h1 in the page layout by default", () => {
    const { container } = render(
      <EmptyState
        layout="page"
        illustration="ticket"
        title="We can't find that page"
        description="The link may be mistyped."
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("We can't find that page");
    expect(container.querySelector("[data-layout='page']")).not.toBeNull();
  });

  it("keeps the level it is given in the page layout, so a page with its own h1 keeps one h1", () => {
    render(
      <main>
        <h1>Basket</h1>
        <EmptyState
          layout="page"
          illustration="parcel"
          title="Your basket is empty"
          description="Browse the shop."
          headingLevel="h2"
        />
      </main>,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Your basket is empty");
  });

  it("shows the askew drawing and announces itself in the error variant", () => {
    const { container } = render(
      <EmptyState variant="error" illustration="frame" title="Failed" description="Try again." />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
    expect(container.querySelector("[data-illustration='askew']")).not.toBeNull();
  });

  it("renders the control between the sentence and the actions, and the while-you-wait slot", () => {
    render(
      <EmptyState
        illustration="search"
        title="No lots"
        description="Try again."
        control={<input aria-label="Search" />}
        actions={<a href="/x">Clear</a>}
        whileYouWait={<a href="/y">Browse</a>}
      />,
    );
    const input = screen.getByLabelText("Search");
    const clear = screen.getByText("Clear");
    const browse = screen.getByText("Browse");
    expect(input.compareDocumentPosition(clear) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(clear.compareDocumentPosition(browse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("uses a custom plate in place of the drawing", () => {
    const { container } = render(
      <EmptyState
        illustration="frame"
        title="Lot"
        description="Gone."
        plate={<div data-testid="hatched" />}
      />,
    );
    expect(screen.getByTestId("hatched")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("compact size uses the compact drawing", () => {
    const { container } = render(
      <EmptyState size="compact" illustration="frame" title="Empty" description="Nothing." />,
    );
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("w-20");
  });
});

describe("EmptyState product options", () => {
  it("draws the plate in the plate ink, which a product may point at its accent", () => {
    const { container } = render(<EmptyState illustration="frame" title="t" description="d" />);
    expect(container.querySelector("[aria-hidden]")?.className).toContain("text-lax-plate");
  });

  it("renders a paragraph title when the page already has its headings", () => {
    const { container } = render(
      <EmptyState illustration="frame" title="t" description="d" headingLevel="p" />,
    );
    expect(container.querySelector("p")?.textContent).toBe("t");
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
