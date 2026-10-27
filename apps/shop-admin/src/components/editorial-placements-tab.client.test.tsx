// @vitest-environment jsdom
import { EditorialPlacementsTab } from "@/components/editorial-placements-tab.client";
import type { AdminPlacementRow } from "@/lib/editorial-placements";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replaceEditorialPlacementSlot } = vi.hoisted(() => ({
  replaceEditorialPlacementSlot: vi.fn(),
}));

vi.mock("@/server/application/admin-editorial-actions.server", () => ({
  replaceEditorialPlacementSlot,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/editorial/home",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const STORY_ID = "5b1c2d3e-0000-4000-8000-000000000001";
const ROWS: AdminPlacementRow[] = [
  {
    id: "p1",
    slot: "home_hero",
    position: 0,
    refKind: "story",
    refId: STORY_ID,
    headline: "Read this",
    mediaKey: null,
    linkUrl: null,
    publishedAt: null,
  },
];

function setup() {
  render(
    <StaffTooltipProvider>
      <EditorialPlacementsTab
        placements={ROWS}
        refLists={{
          exhibition: [],
          story: [{ id: STORY_ID, label: "A story", status: "published" }] as never,
          page: [],
          venue: [],
        }}
      />
    </StaffTooltipProvider>,
  );
  return screen.getByRole("region", { name: "Home · hero" });
}

beforeEach(() => {
  replaceEditorialPlacementSlot.mockReset();
  replaceEditorialPlacementSlot.mockResolvedValue({ ok: true, data: {} });
});

describe("home placements", () => {
  it("names each slot in words, not by its key", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Home · hero" })).toBeInTheDocument();
    expect(screen.queryByText("home_hero")).not.toBeInTheDocument();
  });

  it("offers Save only once something changed", () => {
    const slot = setup();
    const save = within(slot).getByRole("button", { name: "Save slot" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(within(slot).getByLabelText(/^Headline/), { target: { value: "New" } });
    expect(within(slot).getByRole("button", { name: "Save slot" })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(within(slot).getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("saves the slot's rows", async () => {
    const slot = setup();
    fireEvent.change(within(slot).getByLabelText(/^Headline/), { target: { value: "New" } });
    fireEvent.click(within(slot).getByRole("button", { name: "Save slot" }));
    await vi.waitFor(() => expect(replaceEditorialPlacementSlot).toHaveBeenCalledTimes(1));
    expect(replaceEditorialPlacementSlot.mock.calls[0]?.[0]).toMatchObject({
      slot: "home_hero",
      items: [{ position: 0, refKind: "story", refId: STORY_ID, headline: "New" }],
    });
  });

  it("explains a missing target beside its field and in the summary, and does not save", () => {
    const slot = setup();
    fireEvent.click(within(slot).getByRole("button", { name: "Add row" }));
    fireEvent.click(within(slot).getByRole("button", { name: "Save slot" }));
    expect(replaceEditorialPlacementSlot).not.toHaveBeenCalled();
    const summary = within(slot).getByRole("alert");
    expect(within(summary).getByText("Row 2: Choose which exhibition to feature.")).toBeVisible();
    expect(within(slot).getAllByText("Choose which exhibition to feature.").length).toBe(1);
  });
});
