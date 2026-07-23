import { Breadcrumbs } from "@/components/dashboard/primitives/breadcrumbs";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { FilterRow } from "@auction/ui/components/filter-row";
import { SectionTabs } from "@auction/ui/components/section-tabs";
import { StickySaveBar } from "@auction/ui/components/sticky-save-bar";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("DotStatusPill", () => {
  it("renders distinct Lucide glyphs for sold vs unsold", () => {
    const { container: sold } = render(<DotStatusPill label="Sold" tone="sold" />);
    expect(sold.querySelector("svg.lucide-check")).not.toBeNull();

    const { container: unsold } = render(<DotStatusPill label="Unsold" tone="neutral" />);
    expect(unsold.querySelector("svg.lucide-x")).not.toBeNull();
    expect(unsold.querySelector("svg.lucide-check")).toBeNull();
  });

  it("renders harmonized Tag-Review shells for sold and live", () => {
    const { container: sold } = render(<DotStatusPill label="Sold" tone="sold" />);
    const soldShell = sold.firstChild as HTMLElement;
    expect(soldShell.className).toMatch(/bg-success-container/);
    expect(soldShell.className).toMatch(/text-success/);
    expect(soldShell.querySelector("svg.lucide-check")).not.toBeNull();

    const { container: live } = render(<DotStatusPill label="Live" tone="live" />);
    const liveShell = live.firstChild as HTMLElement;
    expect(liveShell.className).toMatch(/bg-danger-container/);
    expect(liveShell.className).toMatch(/text-live-red/);
    expect(liveShell.querySelector("svg.lucide-radio")).not.toBeNull();
  });

  it("uses info blue for pending and warning orange for withdrawn", () => {
    const { container: pending } = render(<DotStatusPill label="Not started" tone="pending" />);
    const pendingShell = pending.firstChild as HTMLElement;
    expect(pendingShell.className).toMatch(/bg-info-container/);
    expect(pendingShell.className).toMatch(/text-info/);
    const pendingPath = pending.querySelector("path")?.getAttribute("d") ?? "";

    const { container: warning } = render(<DotStatusPill label="Withdrawn" tone="warning" />);
    const warningShell = warning.firstChild as HTMLElement;
    expect(warningShell.className).toMatch(/bg-warning-container/);
    expect(warningShell.className).toMatch(/text-warning/);
    const warningPath = warning.querySelector("path")?.getAttribute("d") ?? "";

    expect(pendingPath).not.toEqual(warningPath);
  });

  it("critical uses ban glyph not live radio", () => {
    const { container: critical } = render(<DotStatusPill label="Cancelled" tone="critical" />);
    expect(critical.querySelector("svg.lucide-ban")).not.toBeNull();
    expect(critical.querySelector("svg.lucide-radio")).toBeNull();
    expect((critical.firstChild as HTMLElement).className).toMatch(/text-danger/);
  });
});

describe("FilterRow", () => {
  it("renders link mode chips with active state", () => {
    render(
      <FilterRow
        mode="link"
        label="Status"
        items={[
          { id: "all", label: "All", href: "/x", active: true },
          { id: "due", label: "Due", href: "/x?due=1" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Due" })).not.toHaveAttribute("aria-current");
  });

  it("calls onToggle in toggle mode", () => {
    const onToggle = vi.fn();
    render(
      <FilterRow
        mode="toggle"
        label="Filter"
        items={[{ id: "a", label: "Active", pressed: true }]}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(onToggle).toHaveBeenCalledWith("a");
  });
});

describe("SectionTabs", () => {
  it("renders underline variant with active tab", () => {
    render(
      <SectionTabs
        ariaLabel="Sections"
        variant="underline"
        active="b"
        items={[
          { id: "a", label: "One", href: "/one" },
          { id: "b", label: "Two", href: "/two" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Two" })).toHaveAttribute("aria-current", "page");
  });
});

describe("ConfirmDialog", () => {
  it("renders title and confirm when open", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete lot?"
        body="This cannot be undone."
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Delete lot?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });
});

describe("StickySaveBar", () => {
  it("renders children in sticky footer", () => {
    render(
      <StickySaveBar>
        <button type="button">Save</button>
      </StickySaveBar>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders inline when sticky is false", () => {
    const { container } = render(
      <StickySaveBar sticky={false}>
        <button type="button">Continue</button>
      </StickySaveBar>,
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(container.firstChild).not.toHaveClass("sticky");
  });
});

describe("KpiRow (v3)", () => {
  it("renders tiles with semantic tones", () => {
    render(
      <KpiRow
        tiles={[
          { label: "Active", value: "3", semanticTone: "emphasis" },
          { label: "Due", value: "1", semanticTone: "warning" },
        ]}
      />,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders long currency values without breaking layout", () => {
    render(
      <div className="w-48">
        <KpiRow
          tiles={[{ label: "Portfolio value", value: "£123,456.78", semanticTone: "emphasis" }]}
        />
      </div>,
    );
    expect(screen.getByTitle("£123,456.78")).toBeInTheDocument();
  });
});

describe("DashboardDetailHeader (v3)", () => {
  it("renders back link and sticky class when enabled", () => {
    const { container } = render(
      <DashboardDetailHeader sticky backHref="/dashboard" title="Lot detail" eyebrow="Catalogue" />,
    );
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute("href", "/dashboard");
    expect(container.querySelector("header")?.className).toMatch(/sticky/);
  });
});

describe("DashboardEmptyState (v3)", () => {
  it("hero variant has no dashed border and exposes a labelled region", () => {
    const { container } = render(
      <DashboardEmptyState variant="hero" title="Nothing here" icon={<span aria-hidden>♥</span>} />,
    );
    expect(screen.getByRole("region", { name: "Nothing here" })).toBeInTheDocument();
    expect(container.querySelector(".border-dashed")).toBeNull();
  });

  it("quiet variant keeps dashed frame", () => {
    const { container } = render(<DashboardEmptyState variant="quiet" title="No rows" />);
    expect(container.querySelector(".border-dashed")).not.toBeNull();
  });
});

describe("Breadcrumbs (v4)", () => {
  it("renders trail links and current page", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Lots", href: "/admin/lots" },
          { label: "Detail", href: "/admin/lots/1" },
        ]}
        current="Edit"
      />,
    );
    expect(screen.getByRole("link", { name: "Lots" })).toHaveAttribute("href", "/admin/lots");
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });
});
