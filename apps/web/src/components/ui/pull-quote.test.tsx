import { PullQuote } from "@/components/ui/pull-quote";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("PullQuote", () => {
  it("renders children inside a blockquote", () => {
    render(<PullQuote>A memorable line</PullQuote>);
    expect(screen.getByText("A memorable line")).toBeInTheDocument();
    expect(screen.getByText("A memorable line").closest("blockquote")).toBeTruthy();
  });
});
