import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/dropdown-menu", async () =>
  import("../test/radix-stubs.js").then((m) => m.dropdownMenu),
);

const { Permitted, StaffAccessProvider } = await import("./staff-access.js");
const { StaffButton } = await import("../primitives/button.js");
const { HoldButton } = await import("../primitives/hold-button.js");
const { StaffMenu, StaffMenuContent, StaffMenuItem } = await import("../primitives/menu.js");
const { OverflowMenu } = await import("../shell/overflow-menu.js");
const { CsvExportMenu } = await import("../data/csv-export-menu.js");
const { DetailPage } = await import("../templates/detail-page.js");
const { ListPage } = await import("../templates/list-page.js");
const { StaffChip } = await import("../display/staff-chip.js");

/** A read-only person: may open pages, may change nothing. */
const readOnly = {
  can: (permission: string | { readonly anyOf: readonly string[] }) =>
    (typeof permission === "string" ? [permission] : permission.anyOf).includes("admin.read"),
  roleLabel: "Read-only",
};

function asReadOnly(ui: React.ReactNode) {
  return render(<StaffAccessProvider access={readOnly}>{ui}</StaffAccessProvider>);
}

const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href}>{children}</a>
);

describe("kit actions follow the person's permissions", () => {
  it("leaves out a button the person may never use and keeps the rest", () => {
    asReadOnly(
      <>
        <StaffButton requires="auction.manage">Edit sale</StaffButton>
        <StaffButton requires={{ anyOf: ["auction.manage", "admin.read"] }}>Open</StaffButton>
        <StaffButton>Copy link</StaffButton>
      </>,
    );
    expect(screen.queryByRole("button", { name: "Edit sale" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("offers everything outside a provider", () => {
    render(<StaffButton requires="auction.manage">Edit sale</StaffButton>);
    expect(screen.getByRole("button", { name: "Edit sale" })).toBeInTheDocument();
  });

  it("leaves out a hold button, with its hint", () => {
    asReadOnly(
      <HoldButton requires="saleroom.operate" onHoldComplete={() => {}}>
        Hammer
      </HoldButton>,
    );
    expect(screen.queryByRole("button", { name: "Hammer" })).toBeNull();
    expect(screen.queryByText(/Press and hold/)).toBeNull();
  });

  it("filters menu items and overflow actions, and drops an overflow menu left empty", () => {
    asReadOnly(
      <>
        <StaffMenu>
          <StaffMenuContent>
            <StaffMenuItem requires="auction.manage">Delete sale</StaffMenuItem>
            <StaffMenuItem>Copy link</StaffMenuItem>
          </StaffMenuContent>
        </StaffMenu>
        <OverflowMenu
          label="Lot actions"
          actions={[{ id: "withdraw", label: "Withdraw lot", requires: "auction.manage" }]}
        />
        <OverflowMenu
          label="Sale actions"
          actions={[
            { id: "view", label: "View on site" },
            { id: "delete", label: "Delete sale", tone: "danger", requires: "auction.manage" },
          ]}
        />
      </>,
    );
    expect(screen.queryByText("Delete sale")).toBeNull();
    expect(screen.getByText("Copy link")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lot actions" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sale actions" }));
    expect(screen.getByText("View on site")).toBeInTheDocument();
  });

  it("hides an export the person may not take", () => {
    asReadOnly(
      <CsvExportMenu noun="staff" shown={3} total={3} onExport={() => {}} requires="user.invite" />,
    );
    expect(screen.queryByRole("button", { name: /Export/ })).toBeNull();
  });

  it("renders a fallback in place of a control the person may not use", () => {
    asReadOnly(
      <Permitted requires="auction.manage" fallback={<span>Autumn sale</span>}>
        <input aria-label="Sale title" />
      </Permitted>,
    );
    expect(screen.queryByLabelText("Sale title")).toBeNull();
    expect(screen.getByText("Autumn sale")).toBeInTheDocument();
  });

  it("keeps a chip but drops its remove button", () => {
    asReadOnly(<StaffChip label="Finance" onRemove={() => {}} removeRequires="user.invite" />);
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Finance" })).toBeNull();
  });
});

describe("page templates read their access from the kit", () => {
  it("shows a record view only, with the person's roles, when they cannot edit it", () => {
    asReadOnly(
      <DetailPage
        title="Autumn sale"
        editRequires="auction.manage"
        primaryAction={<StaffButton requires="auction.manage">Publish sale</StaffButton>}
      >
        Body
      </DetailPage>,
    );
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish sale" })).toBeNull();
  });

  it("keeps a record actionable for someone who may edit it", () => {
    render(
      <StaffAccessProvider access={{ can: () => true, roleLabel: "Sales manager" }}>
        <DetailPage
          title="Autumn sale"
          editRequires="auction.manage"
          primaryAction={<StaffButton requires="auction.manage">Publish sale</StaffButton>}
        >
          Body
        </DetailPage>
      </StaffAccessProvider>,
    );
    expect(screen.queryByText(/View only/)).toBeNull();
    expect(screen.getByRole("button", { name: "Publish sale" })).toBeInTheDocument();
  });

  it("shows a list view only, without its primary action", () => {
    asReadOnly(
      <ListPage<{ id: string }>
        title="Sales"
        Link={Link}
        listKey="test.sales"
        editRequires="auction.manage"
        primaryAction={<StaffButton requires="auction.manage">New sale</StaffButton>}
        filtered={false}
        empty={{ title: "No sales yet" }}
        noResults={{ noun: "sales" }}
        table={{ columns: [], data: [], getRowId: (row) => row.id }}
      />,
    );
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New sale" })).toBeNull();
  });

  it("keeps a permitted primary action on a record the person cannot edit", () => {
    const clerk = {
      can: (permission: string | { readonly anyOf: readonly string[] }) =>
        (typeof permission === "string" ? [permission] : permission.anyOf).includes(
          "saleroom.operate",
        ),
      roleLabel: "Saleroom clerk",
    };
    render(
      <StaffAccessProvider access={clerk}>
        <DetailPage
          title="Autumn sale"
          editRequires="auction.manage"
          primaryAction={<StaffButton requires="saleroom.operate">Open saleroom</StaffButton>}
          secondaryActions={<StaffButton requires="auction.manage">Edit sale</StaffButton>}
        >
          Body
        </DetailPage>
      </StaffAccessProvider>,
    );
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open saleroom" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit sale" })).toBeNull();
  });
});
