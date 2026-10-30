import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/tooltip", () =>
  import("../test/radix-stubs.js").then((m) => m.tooltip),
);

const { KeyValueList } = await import("./key-value-list.js");
const { Count, formatCount } = await import("@auction/ui/lax");

describe("KeyValueList", () => {
  it("keeps a copyable reference on one line instead of breaking it mid-word", () => {
    const { container } = render(
      <KeyValueList
        items={[
          {
            label: "Email",
            value: "eleanor.whitcombe@example.co.uk",
            copyValue: "eleanor.whitcombe@example.co.uk",
          },
          { label: "Note", value: "A long note that may wrap over lines" },
        ]}
      />,
    );
    const [email, note] = Array.from(container.querySelectorAll("dd"));
    expect(email?.querySelector(".truncate")).not.toBeNull();
    expect(email).toHaveTextContent("eleanor.whitcombe@example.co.uk");
    expect(screen.getByRole("button", { name: "Copy email" })).toBeInTheDocument();
    expect(note?.querySelector(".break-words")).not.toBeNull();
  });
});

describe("Count", () => {
  it("shows the real number, in full, until it would not fit a tab", () => {
    expect(formatCount(1284)).toBe("1,284");
    expect(formatCount(99_999)).toBe("99,999");
    expect(formatCount(312_400)).toBe("312k");
    render(<Count value={1284} />);
    expect(screen.getByText("1,284")).toBeInTheDocument();
  });
});
