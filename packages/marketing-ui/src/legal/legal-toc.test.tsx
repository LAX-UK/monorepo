import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegalToc } from "./legal-toc.js";

describe("LegalToc", () => {
  it("keeps the collapsible trigger out of the heading outline", () => {
    render(
      <LegalToc
        items={[
          { id: "one", label: "First" },
          { id: "two", label: "Second" },
        ]}
      />,
    );

    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "On this page" })).toBeInTheDocument();
  });
});
