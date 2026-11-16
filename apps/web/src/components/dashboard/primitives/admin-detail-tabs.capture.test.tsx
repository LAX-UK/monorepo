import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@auction/ui/components/sheet";
import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import { AdminDetailTabs } from "./admin-detail-tabs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users/1",
  useRouter: () => ({ replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const out = process.env.MOTION7_OUT;

const rows = [
  ["Ada Lovelace", "Approved", "£4,140.00"],
  ["Grace Hopper", "Pending", "£1,200.00"],
  ["Mary Jackson", "Approved", "£860.00"],
];

function Table() {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="py-2 text-left">Client</th>
          <th className="py-2 text-left">Status</th>
          <th className="py-2 text-left">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]} className="border-t border-border-hairline">
            {r.map((c) => (
              <td key={c} className="py-2">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Captures the real Bid admin tabs and a kit drawer as HTML for the motion-7 screenshots. */
describe.skipIf(!out)("motion-7 capture: Bid admin", () => {
  it("writes tabs and drawer", () => {
    const dir = out as string;
    mkdirSync(dir, { recursive: true });
    const { container, unmount } = render(
      <div data-staff-ui="" data-lax-density="staff" className="p-6">
        <AdminDetailTabs
          defaultValue="overview"
          tabs={[
            { value: "overview", label: "Overview", content: <Table /> },
            { value: "payments", label: "Payments", content: <Table /> },
            { value: "compliance", label: "Compliance", content: <Table /> },
          ]}
        />
      </div>,
    );
    writeFileSync(path.join(dir, "bid-tabs.html"), container.innerHTML);
    unmount();
    render(
      <div data-staff-ui="" data-lax-density="staff" className="p-6">
        <Table />
        <Sheet open>
          <SheetContent side="right">
            <SheetTitle>Ada Lovelace</SheetTitle>
            <SheetDescription>Client record</SheetDescription>
            <Table />
          </SheetContent>
        </Sheet>
      </div>,
    );
    writeFileSync(path.join(dir, "bid-drawer.html"), document.body.innerHTML);
  });
});
