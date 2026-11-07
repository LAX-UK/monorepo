import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type ChangesRow, ChangesTable } from "./changes-table.js";

const rows: ChangesRow[] = [
  {
    id: "title",
    label: "Title",
    before: "Harbour at dusk",
    after: "Harbour at Dusk",
    changes: true,
  },
  { id: "artist", label: "Artist", before: "Ben Ilsley", after: "Ben Ilsley", changes: false },
  { id: "size", label: "Size", before: null, after: "61 × 81 cm", changes: true },
];

function renderTable() {
  return render(
    <ChangesTable
      label="What linking changes"
      beforeHeading="lax.art now"
      afterHeading="From Zoho, after linking"
      rows={rows}
    />,
  );
}

describe("ChangesTable", () => {
  it("names the two columns and every field", () => {
    renderTable();
    const table = screen.getByRole("table", { name: "What linking changes" });
    expect(within(table).getByRole("columnheader", { name: "lax.art now" })).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "From Zoho, after linking" }),
    ).toBeInTheDocument();
    for (const row of rows) {
      expect(within(table).getByRole("rowheader", { name: row.label })).toBeInTheDocument();
    }
  });

  it("highlights the rows that change and strikes the old value through", () => {
    const { container } = renderTable();
    const changed = Array.from(container.querySelectorAll('tr[data-changes="true"]'));
    expect(changed).toHaveLength(2);
    expect(changed[0]?.querySelector("td")).toHaveClass("line-through");
    const unchanged = container.querySelector('tr[data-changes="false"]');
    expect(unchanged?.querySelector("td")).not.toHaveClass("line-through");
  });

  it("says was and now to a screen reader, so colour is not the only cue", () => {
    renderTable();
    const title = screen.getByRole("row", { name: /Title/ });
    expect(title).toHaveTextContent("was Harbour at dusk");
    expect(title).toHaveTextContent("now Harbour at Dusk");
  });

  it("says Empty for a value that is not there", () => {
    renderTable();
    expect(screen.getByRole("row", { name: /Size/ })).toHaveTextContent("was Empty");
  });
});
