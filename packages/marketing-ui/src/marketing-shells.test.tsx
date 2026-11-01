import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingCatalogHubShell } from "./marketing-catalog-hub-shell";
import { MarketingDetailShell } from "./marketing-detail-shell";

describe.each([
  ["MarketingCatalogHubShell", MarketingCatalogHubShell],
  ["MarketingDetailShell", MarketingDetailShell],
])("%s", (_name, Shell) => {
  it("owns the main landmark by default", () => {
    const { container } = render(<Shell>content</Shell>);
    expect(container.querySelectorAll("main#main-content")).toHaveLength(1);
  });

  it("renders a plain container when the layout owns the landmark", () => {
    const { container } = render(<Shell as="div">content</Shell>);
    expect(container.querySelector("main")).toBeNull();
    expect(container.querySelector("#main-content")).toBeNull();
    expect(container.textContent).toBe("content");
  });
});
