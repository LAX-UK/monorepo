import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmailLink, TextWithEmails } from "./email-text.js";

describe("EmailLink", () => {
  it("links to the address and reads as the address, with no contiguous address in the markup", () => {
    const { container } = render(<EmailLink address="support@lax.bid" className="link" />);

    const link = screen.getByRole("link", { name: "support@lax.bid" });
    expect(link).toHaveAttribute("href", "mailto:support@lax.bid");
    expect(link).toHaveClass("link");
    expect(container.querySelector("a")?.textContent).toBe("support@lax.bid");
    expect(container.querySelector("a")?.innerHTML).not.toContain("support@lax.bid");
  });

  it("adds a query to the link only", () => {
    render(<EmailLink address="a@b.co" query="?subject=Hello" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "mailto:a@b.co?subject=Hello");
  });
});

describe("TextWithEmails", () => {
  it("keeps the sentence and splits only the addresses", () => {
    const { container } = render(
      <p>
        <TextWithEmails text="Write to info@lax.art or call us, or to pr@lax.bid." />
      </p>,
    );

    expect(container.textContent).toBe("Write to info@lax.art or call us, or to pr@lax.bid.");
    expect(container.innerHTML).not.toMatch(/[a-z]@[a-z]/);
  });

  it("returns text without an address unchanged", () => {
    const { container } = render(
      <p>
        <TextWithEmails text="No address here." />
      </p>,
    );
    expect(container.innerHTML).toBe("<p>No address here.</p>");
  });
});
