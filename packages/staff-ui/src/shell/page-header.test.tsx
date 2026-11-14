import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetaItem } from "./page-header.js";

describe("MetaItem", () => {
  it("lets a very long unbreakable value break inside its own row", () => {
    const email = `${"a".repeat(120)}@example.test`;
    render(<MetaItem label="Email">{email}</MetaItem>);
    const value = screen.getByText(email);
    expect(value.className).toContain("min-w-0");
    expect(value.className).toContain("max-w-full");
    expect(value.className).toContain("[overflow-wrap:anywhere]");
    expect(value.parentElement?.className).toContain("max-w-full");
  });

  it("keeps the label on one line and a normal value as plain text", () => {
    render(<MetaItem label="Total">£100.00</MetaItem>);
    expect(screen.getByText("Total").className).toContain("whitespace-nowrap");
    expect(screen.getByText("£100.00").className).not.toContain("break-all");
  });
});
