/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FactList } from "./fact-list";

describe("FactList", () => {
  it("renders each fact as dl > div > dt + dd", () => {
    const { container } = render(
      <FactList
        facts={[
          { label: "Medium", value: "Oil on canvas" },
          { label: "Size", value: "60 x 80 cm" },
        ]}
      />,
    );
    const dl = container.querySelector("dl");
    expect(dl).not.toBeNull();
    const groups = Array.from(dl?.children ?? []);
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group.tagName).toBe("DIV");
      expect(Array.from(group.children).map((c) => c.tagName)).toEqual(["DT", "DD"]);
    }
    expect(groups[0]?.textContent).toBe("MediumOil on canvas");
  });
});
