import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PlainLink } from "@auction/ui/lax";
import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { PrimaryCell } from "./data/cells.js";
import { DataTable } from "./data/data-table.js";
import { DetailPanel } from "./panels/detail-panel.js";

const out = process.env.MOTION7_OUT;

type Row = { id: string; name: string; status: string; total: string };
const data: Row[] = [
  { id: "a", name: "LAX-10432", status: "Packed", total: "£4,140.00" },
  { id: "b", name: "LAX-10433", status: "Awaiting payment", total: "£1,200.00" },
  { id: "c", name: "LAX-10434", status: "Shipped", total: "£860.00" },
];

function Table() {
  return (
    <DataTable<Row>
      label="Orders"
      data={data}
      getRowId={(r) => r.id}
      rowHref={(r) => `/orders/${r.id}`}
      columns={[
        {
          id: "name",
          header: "Order",
          mobile: "title",
          cell: (r) => (
            <PrimaryCell href={`/orders/${r.id}`} Link={PlainLink}>
              {r.name}
            </PrimaryCell>
          ),
        },
        { id: "status", header: "Status", cell: (r) => r.status },
        { id: "total", header: "Total", cell: (r) => r.total },
      ]}
    />
  );
}

/** Captures the real LAX Admin table and detail panel as HTML for the motion-7 screenshots. */
describe.skipIf(!out)("motion-7 capture: LAX Admin", () => {
  it("writes list and panel", () => {
    const dir = out as string;
    mkdirSync(dir, { recursive: true });
    const { container, unmount } = render(
      <div data-staff-ui="" data-lax-density="staff" className="p-6">
        <Table />
      </div>,
    );
    writeFileSync(path.join(dir, "lax-list.html"), container.innerHTML);
    unmount();
    render(
      <div data-staff-ui="" data-lax-density="staff" className="p-6">
        <Table />
        <DetailPanel
          open
          onOpenChange={() => {}}
          title="LAX-10432"
          meta={[{ label: "Buyer", value: "Ada Lovelace" }]}
          summary={[
            { label: "Status", value: "Packed" },
            { label: "Total", value: "£4,140.00" },
          ]}
        >
          <p>Order details</p>
        </DetailPanel>
      </div>,
    );
    writeFileSync(path.join(dir, "lax-panel.html"), document.body.innerHTML);
  });
});
