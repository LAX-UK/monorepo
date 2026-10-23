import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FilterFieldVm } from "../lib/filter-query";
import { ActiveFilterChips, FilterPanelFields } from "./filter-toolbar.client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const fields: FilterFieldVm[] = [
  {
    name: "product",
    label: "Product",
    value: "bid",
    options: [
      { value: "bid", label: "LAX Bid" },
      { value: "shop", label: "LAX Shop" },
    ],
  },
  { name: "artist", label: "Artist", value: "", options: [] },
  {
    name: "year",
    label: "Year acquired",
    value: "",
    chipPrefix: "Acquired in",
    options: [{ value: "2026", label: "2026" }],
  },
];

describe("FilterPanelFields", () => {
  const html = renderToStaticMarkup(<FilterPanelFields fields={fields} onChoose={() => {}} />);

  it("gives each group a heading that labels its radio group, with Any first", () => {
    expect(html).toContain("Product");
    expect(html).toContain('role="radiogroup"');
    expect(html).toMatch(/aria-labelledby="[^"]*-product"/);
    expect(html.indexOf("Any")).toBeLessThan(html.indexOf("LAX Bid"));
  });

  it("selects the current option", () => {
    expect(html).toContain('aria-checked="true"');
  });

  it("leaves out a group with nothing to choose from", () => {
    expect(html).not.toContain("Artist");
  });
});

describe("ActiveFilterChips", () => {
  it("renders sentence-case chips that name what pressing them does", () => {
    const html = renderToStaticMarkup(
      <ActiveFilterChips fields={fields} canClearAll onRemove={() => {}} onClearAll={() => {}} />,
    );
    expect(html).toContain("LAX Bid");
    expect(html).toContain('aria-label="Remove Product filter: LAX Bid"');
    expect(html).not.toContain("uppercase");
    expect(html).toContain("Clear all");
  });

  it("prefixes a chip whose option is unclear on its own", () => {
    const html = renderToStaticMarkup(
      <ActiveFilterChips
        fields={[{ ...(fields[2] as FilterFieldVm), value: "2026" }]}
        canClearAll
        onRemove={() => {}}
        onClearAll={() => {}}
      />,
    );
    expect(html).toContain("Acquired in 2026");
  });

  it("renders nothing when nothing is applied", () => {
    expect(
      renderToStaticMarkup(
        <ActiveFilterChips
          fields={fields.map((f) => ({ ...f, value: "" }))}
          canClearAll={false}
          onRemove={() => {}}
          onClearAll={() => {}}
        />,
      ),
    ).toBe("");
  });
});
