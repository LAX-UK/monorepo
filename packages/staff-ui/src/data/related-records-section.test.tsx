import { render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it } from "vitest";
import { RelatedRecordsSection } from "./related-records-section.js";
import type { DataColumn } from "./types.js";

type Row = { id: string; title: string };
const columns: DataColumn<Row>[] = [{ id: "title", header: "Order", cell: (row) => row.title }];
const Link = ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

function renderSection(props: Partial<React.ComponentProps<typeof RelatedRecordsSection<Row>>>) {
  return render(
    <RelatedRecordsSection<Row>
      title="Orders"
      columns={columns}
      data={[
        { id: "a", title: "Order A" },
        { id: "b", title: "Order B" },
      ]}
      getRowId={(row) => row.id}
      defaultSort={{ columnId: "title", direction: "desc" }}
      empty={{ title: "No orders yet", description: "Orders they place appear here." }}
      {...props}
    />,
  );
}

describe("RelatedRecordsSection", () => {
  it("names its rows in a section with an embedded table", () => {
    renderSection({});
    const section = screen.getByRole("heading", { name: "Orders" }).closest("section");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByRole("table", { name: "Orders" })).toBeVisible();
    expect(screen.getAllByText("Order B").length).toBeGreaterThan(0);
  });

  it("links to the full list with the total when it shows only the newest rows", () => {
    renderSection({ viewAll: { href: "/orders?q=ada", total: 1284, Link } });
    expect(screen.getByRole("link", { name: "View all 1,284" })).toHaveAttribute(
      "href",
      "/orders?q=ada",
    );
  });

  it("leaves out View all when every row is already shown", () => {
    renderSection({ viewAll: { href: "/orders?q=ada", total: 2, Link } });
    expect(screen.queryByRole("link", { name: /View all/ })).toBeNull();
  });

  it("says what will appear when there are no rows", () => {
    renderSection({ data: [] });
    expect(screen.getByRole("heading", { name: "No orders yet" })).toBeInTheDocument();
    expect(screen.getByText("Orders they place appear here.")).toBeInTheDocument();
  });
});
