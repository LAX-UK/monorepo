import { Breadcrumbs } from "@/components/dashboard/primitives/breadcrumbs";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { FilterRow } from "@auction/ui/components/filter-row";
import { SectionTabs } from "@auction/ui/components/section-tabs";
import { StickySaveBar } from "@auction/ui/components/sticky-save-bar";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
