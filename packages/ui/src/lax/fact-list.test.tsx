import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FactList } from "./index.js";

describe("FactList", () => {
  it("renders one dt and one dd inside each row div", () => {
    const { container } = render(
      <FactList
        facts={[
          { label: "Signed", value: "Signed and dated lower right" },
          { label: "Location", value: "Mayfair saleroom" },
        ]}
      />,
    );
    const list = container.querySelector("dl");
    expect(list).not.toBeNull();
    const rows = Array.from(list?.children ?? []);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.tagName).toBe("DIV");
      expect(row.querySelectorAll(":scope > dt")).toHaveLength(1);
      expect(row.querySelectorAll(":scope > dd")).toHaveLength(1);
    }
    expect(within(rows[0] as HTMLElement).getByText("Signed")).toBeInTheDocument();
    expect(screen.getByText("Mayfair saleroom")).toBeInTheDocument();
  });

  it("renders nothing without facts", () => {
    const { container } = render(<FactList facts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
