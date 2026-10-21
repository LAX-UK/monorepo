import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingSpecList } from "./marketing-spec-list.js";

describe("MarketingSpecList", () => {
  it("pairs each label with its value in a description list", () => {
    const { container } = render(
      <MarketingSpecList
        items={[
          { label: "Year", value: "2024" },
          { label: "Medium", value: "Oil on linen" },
        ]}
      />,
    );
    expect(container.querySelector("dl")).not.toBeNull();
    const terms = [...container.querySelectorAll("dt")].map((node) => node.textContent);
    const details = [...container.querySelectorAll("dd")].map((node) => node.textContent);
    expect(terms).toEqual(["Year", "Medium"]);
    expect(details).toEqual(["2024", "Oil on linen"]);
  });

  it("renders nothing without items", () => {
    const { container } = render(<MarketingSpecList items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
