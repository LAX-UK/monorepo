import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubmissionSentPanel } from "./submission-sent-panel";

const props = {
  reference: "C-1042",
  consignmentHref: "/selling/consignments/s1",
  sellAnotherHref: "/selling/new",
  responsePromise: "Our specialists usually reply within one working day.",
};

describe("SubmissionSentPanel", () => {
  it("says the work was sent, with its reference and the one reply promise", () => {
    render(<SubmissionSentPanel {...props} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Sent to our specialists · Reference C-1042" }),
    ).toBeInTheDocument();
    expect(screen.getByText(props.responsePromise)).toBeInTheDocument();
  });

  it("leaves the reference out when the consignment has none", () => {
    render(<SubmissionSentPanel {...props} reference={null} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Sent to our specialists" }),
    ).toBeInTheDocument();
  });

  it("lists the stages in the names the consignments list uses", () => {
    render(<SubmissionSentPanel {...props} />);
    const next = screen.getByRole("region", { name: "What happens next" });
    const stages = within(next)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("p")?.textContent);
    expect(stages).toEqual(["In review", "Accepted", "In a sale"]);
  });

  it("offers the consignment and another work", () => {
    render(<SubmissionSentPanel {...props} />);
    expect(screen.getByRole("link", { name: "View your consignment" })).toHaveAttribute(
      "href",
      "/selling/consignments/s1",
    );
    expect(screen.getByRole("link", { name: "Sell another work" })).toHaveAttribute(
      "href",
      "/selling/new",
    );
  });
});
