"use client";

import {
  type AppliedFilter,
  Button,
  Dialog,
  DialogClose,
  ExportSheet,
  Field,
  FilterSheet,
  ListToolbar,
  type PaletteGroup,
  PlainLink,
  SearchPalette,
  ShowingCount,
  SortMenu,
  type TabNavItem,
  TextInput,
} from "@auction/ui/lax";
import { Download, FileText, Gavel, Image as ImageIcon, Search } from "lucide-react";
import { useState } from "react";
import { SheetSection } from "./sheet-frame";

const TABS: readonly TabNavItem[] = [
  { id: "all", label: "All", href: "#all", count: 14 },
  { id: "needs", label: "Needs you", href: "#needs", count: 2, countTone: "attention" },
  { id: "drafts", label: "Drafts", href: "#drafts", count: 1 },
  { id: "review", label: "In review", href: "#review", count: 2 },
  { id: "sale", label: "In a sale", href: "#sale", count: 6 },
  { id: "sold", label: "Sold", href: "#sold", count: 2 },
];

type Sort = "updated" | "estimate" | "title";

const START_FILTERS: AppliedFilter[] = [
  { id: "sent", label: "Sent by: Lena Fischer" },
  { id: "sale", label: "Sale: Autumn online" },
];

function ConsignmentsToolbar() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const [filters, setFilters] = useState(START_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shown, setShown] = useState(5);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button icon={<Download aria-hidden />} onClick={() => setExportOpen(true)}>
          Export
        </Button>
      </div>
      <ListToolbar
        tabs={{ items: TABS, activeId: "all", label: "Consignments", Link: PlainLink }}
        search={{
          value: query,
          onValueChange: setQuery,
          placeholder: "Search by artist, title or reference",
        }}
        filter={{ count: filters.length, open: filterOpen, onOpenChange: setFilterOpen }}
        sort={
          <SortMenu<Sort>
            value={sort}
            onValueChange={setSort}
            options={[
              { value: "updated", label: "Last updated" },
              { value: "estimate", label: "Estimate, high to low" },
              { value: "title", label: "Title, A to Z" },
            ]}
          />
        }
        chips={{
          filters,
          onRemove: (id) => setFilters((all) => all.filter((filter) => filter.id !== id)),
          onClearAll: () => setFilters([]),
        }}
      />
      <div className="grid h-24 place-items-center rounded-lax-card border border-dashed border-lax-line-strong text-lax-13 text-lax-muted">
        The list
      </div>
      <ShowingCount
        shown={shown}
        total={14}
        onShowMore={() => setShown((n) => Math.min(14, n + 5))}
      />
      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        resultCount={4}
        onApply={() => undefined}
        onClear={() => setFilters([])}
      >
        <Field label="Sent by">
          <TextInput defaultValue="Lena Fischer" />
        </Field>
        <Field label="Sale" optional>
          <TextInput placeholder="Any sale" />
        </Field>
      </FilterSheet>
      <ExportSheet<"csv" | "pdf">
        open={exportOpen}
        onOpenChange={setExportOpen}
        subject="consignments"
        viewCount={14}
        defaultFormat="csv"
        period={{ from: "2026-01-01", to: "2026-10-30" }}
        formats={[
          { value: "csv", label: "Spreadsheet (CSV)", description: "Opens in Excel and Numbers." },
          {
            value: "pdf",
            label: "Statements (PDF)",
            description: "One file per payout, in a zip.",
          },
        ]}
        note="Large exports are prepared in the background and we email you a link."
        onExport={() => undefined}
      />
    </div>
  );
}

export function SheetListToolbar() {
  return (
    <SheetSection
      id="list-toolbar"
      title="List toolbar and export"
      description="Tabs with counts, search, Filter with a count and its sheet, Sort, the applied filters as removable chips, and Showing n of m under the list. Export opens one sheet for every list."
    >
      {() => <ConsignmentsToolbar />}
    </SheetSection>
  );
}

const RESULTS: readonly PaletteGroup[] = [
  {
    id: "lots",
    label: "Lots",
    items: [
      {
        id: "57",
        label: "Harbour at dawn",
        meta: "Lot 57 · won · payment overdue",
        media: <Gavel aria-hidden />,
      },
      {
        id: "29",
        label: "Harbour, first light",
        meta: "Lot 29 · sold for Northbank Gallery",
        media: <ImageIcon aria-hidden />,
      },
    ],
  },
  {
    id: "invoices",
    label: "Invoices",
    items: [
      {
        id: "inv",
        label: "INV-2026-0412 · Harbour at dawn",
        meta: "£6,450.00 · overdue",
        media: <FileText aria-hidden />,
      },
    ],
  },
  {
    id: "pages",
    label: "Pages",
    items: [{ id: "sold", label: "Sold & payouts", meta: "Page", shortcut: "g s" }],
  },
];

function PaletteDemo() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("harb");
  const [dialogOpen, setDialogOpen] = useState(false);
  const groups = query.trim()
    ? RESULTS.map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.label.toLowerCase().includes(query.trim().toLowerCase()),
        ),
      }))
    : RESULTS;
  return (
    <div className="flex flex-wrap gap-2">
      <Button icon={<Search aria-hidden />} onClick={() => setOpen(true)}>
        Search Northbank Gallery
      </Button>
      <Button onClick={() => setDialogOpen(true)}>Open a dialog</Button>
      <SearchPalette
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        placeholder="Search Northbank Gallery"
        groups={groups}
        onSelect={() => undefined}
        scopeNote="Showing what a consignor can open. Purchases, invoices and people aren't searched."
      />
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Transfer ownership to Daniel Reyes"
        description="Daniel becomes the owner of Northbank Gallery. You become an admin and can no longer change the two-step policy or transfer ownership."
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button variant="danger" disabledReason="Type the confirmation first">
              Transfer ownership
            </Button>
          </>
        }
      >
        <Field label='To confirm, type "Transfer to Daniel Reyes"'>
          <TextInput defaultValue="Transfer to Daniel" />
        </Field>
      </Dialog>
    </div>
  );
}

export function SheetOverlays() {
  return (
    <SheetSection
      id="overlays"
      title="Search palette, dialog and bottom sheet"
      description="Search opens from ⌘K, / or the field in the bar, follows the combobox pattern and searches only what the role may open. A dialog is 520px on the 12px radius; on a phone both rise from the bottom."
    >
      {() => <PaletteDemo />}
    </SheetSection>
  );
}
