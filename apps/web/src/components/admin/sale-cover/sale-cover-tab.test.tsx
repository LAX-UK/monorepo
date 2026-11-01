import { SaleCoverSkeleton } from "@/components/admin/sale-cover/sale-cover-skeleton";
import { SaleCoverTab } from "@/components/admin/sale-cover/sale-cover-tab";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOTS, OTHER_SALE, SALE_ID, coverView, slotView, storedSlot } from "./sale-cover.fixtures";

const save = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/admin-sale-cover", () => ({
  adminSaveSaleCoverAction: (...args: unknown[]) => save(...args),
}));

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("@/lib/ui/notify", () => ({ notify }));

vi.mock("@/components/admin/form-dirty-guard", () => ({
  FormDirtyGuard: ({ isDirty }: { isDirty: boolean }) => (
    <span data-testid="guard" data-dirty={String(isDirty)} />
  ),
}));

const upload = vi.hoisted(() => ({
  key: "covers/new.jpg",
  size: { width: 3600, height: 2400 } as { width: number; height: number } | null,
}));
vi.mock("@/components/admin/media/staff-single-image", () => ({
  StaffSingleImage: ({
    onChange,
    noun,
    disabled,
  }: { onChange: (key: string | null) => void; noun: string; disabled?: boolean }) => (
    <button type="button" disabled={disabled} onClick={() => onChange(upload.key)}>
      {`Upload ${noun}`}
    </button>
  ),
}));
vi.mock("@/components/admin/sale-cover/measure-picture", () => ({
  measurePicture: async () => upload.size,
}));
vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const render_ = (props: Partial<Parameters<typeof SaleCoverTab>[0]> = {}) =>
  render(
    <SaleCoverTab
      saleId={SALE_ID}
      saleTitle="Spring Evening Sale"
      saleStatus="active"
      view={coverView()}
      lots={LOTS}
      canEdit
      {...props}
    />,
  );

const guard = () => screen.getByTestId("guard").getAttribute("data-dirty");
const saveButton = () => screen.getByRole("button", { name: "Save changes" });

describe("SaleCoverTab", () => {
  afterEach(cleanup);
  beforeEach(() => {
    save.mockReset();
    save.mockResolvedValue({ ok: true });
    router.refresh.mockReset();
    notify.success.mockReset();
    upload.key = "covers/new.jpg";
    upload.size = { width: 3600, height: 2400 };
  });

  describe("empty", () => {
    it("says each slot is empty and offers the first picture", () => {
      render_();
      expect(screen.getByRole("tab", { name: /Default.*Not set yet/ })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Wide.*Uses the default/ })).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: /Phone.*Uses a crop of the default/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Upload default cover picture/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use a lot photo" })).toBeInTheDocument();
      expect(screen.getByText(/Set a default picture to see the three crops/)).toBeInTheDocument();
      expect(screen.getByText(/No lots are featured/)).toBeInTheDocument();
      expect(screen.getByText("All changes saved.")).toBeInTheDocument();
      expect(guard()).toBe("false");
    });

    it("sets a first picture, checks its size and asks for alt text before saving", async () => {
      render_();
      fireEvent.click(screen.getByRole("button", { name: /Upload default cover picture/ }));
      expect(
        await screen.findByRole("group", { name: /default cover picture/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /3600 × 2400 · uploaded/ })).toBeInTheDocument();
      expect(guard()).toBe("true");
      expect(screen.getByText("Describe the picture for screen readers.")).toBeInTheDocument();
      expect(saveButton()).toHaveAttribute("aria-disabled", "true");

      fireEvent.change(screen.getByRole("textbox", { name: /Alt text/ }), {
        target: { value: "Evening water" },
      });
      expect(saveButton()).not.toHaveAttribute("aria-disabled", "true");
      fireEvent.click(saveButton());
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      expect(save.mock.calls[0]?.[1]).toMatchObject({
        puts: [
          {
            name: "default",
            body: {
              source: { kind: "upload", key: "covers/new.jpg" },
              focal: { x: 0.5, y: 0.5 },
              zoom: 1,
              alt: "Evening water",
            },
          },
        ],
        clears: [],
        home: null,
        pins: null,
      });
      await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Cover and home saved"));
      expect(router.refresh).toHaveBeenCalled();
    });
  });

  describe("size checks", () => {
    it("blocks a default picture under 2400px wide and says what is needed", async () => {
      upload.size = { width: 1800, height: 1800 };
      render_();
      fireEvent.click(screen.getByRole("button", { name: /Upload default cover picture/ }));
      expect(
        await screen.findByText(/needs at least 2400px wide\. Use a larger picture or less zoom/),
      ).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /needs 2400 · not used/ })).toBeInTheDocument();
      fireEvent.change(screen.getByRole("textbox", { name: /Alt text/ }), {
        target: { value: "Evening water" },
      });
      expect(saveButton()).toHaveAttribute("aria-disabled", "true");
    });

    it("holds the phone slot to 1200 × 1200", async () => {
      upload.size = { width: 640, height: 640 };
      render_({ view: coverView({ slots: { default: slotView("default", storedSlot()) } }) });
      fireEvent.click(screen.getByRole("tab", { name: /Phone/ }));
      fireEvent.click(screen.getByRole("button", { name: /Upload phone cover picture/ }));
      expect(await screen.findByText(/needs at least 1200 × 1200/)).toBeInTheDocument();
      expect(
        screen.getByText(/Phones show a crop of the default picture meanwhile/),
      ).toBeInTheDocument();
    });
  });

  describe("measured", () => {
    const view = coverView({
      slots: {
        default: slotView("default", storedSlot()),
        wide: slotView("wide", storedSlot({ key: "covers/wide.jpg", width: 3200, height: 1200 })),
      },
      home: {
        subtitle: "British and European paintings",
        featuredLotIds: [LOTS[1]?.id as string, LOTS[0]?.id as string],
        consignmentDeadline: "2026-11-20T23:59:00.000Z",
        homePinOrder: 2,
      },
      pins: [
        { saleId: OTHER_SALE, title: "Modern Masters", position: 1 },
        { saleId: SALE_ID, title: "Spring Evening Sale", position: 2 },
      ],
    });

    it("shows the three crops with the measured tone and lowest contrast", () => {
      render_({ view });
      for (const box of ["wide", "desktop", "phone"]) {
        expect(screen.getByTestId(`preview-${box}`)).toBeInTheDocument();
      }
      const badges = screen.getAllByText(/^AA · \d+\.\d{2}:1 lowest$/);
      expect(badges).toHaveLength(2);
      expect(screen.getByText("Type below the image")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /Auto · white, 0\.\d\d/ })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Auto · left" })).toBeInTheDocument();
      expect(screen.queryByText("Analysing…")).not.toBeInTheDocument();
    });

    it("shows each slot's size and source, and the home settings as saved", () => {
      render_({ view });
      expect(
        screen.getByRole("tab", { name: /Default.*3600 × 2400 · uploaded/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Wide.*3200 × 1200 · uploaded/ })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /Subtitle/ })).toHaveValue(
        "British and European paintings",
      );
      expect(screen.getByRole("checkbox", { name: /Pin to the home hero/ })).toBeChecked();
      expect(screen.getByText(/Position 2 of 3/)).toBeInTheDocument();
      expect(screen.getByDisplayValue("20 Nov 2026")).toBeInTheDocument();
    });

    it("changing the focal point from the keyboard changes the crop and marks the page unsaved", () => {
      render_({ view });
      const picture = screen.getByRole("group", { name: /default cover picture/ });
      expect(picture).toHaveAccessibleName(/Focal point at 72% across and 46% down/);
      fireEvent.keyDown(picture, { key: "ArrowLeft" });
      expect(screen.getByRole("group", { name: /default cover picture/ })).toHaveAccessibleName(
        /Focal point at 71% across/,
      );
      expect(guard()).toBe("true");
      expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();
      // The picture was measured with the old focal point, so the numbers wait for a save.
      expect(screen.getAllByText("Measured after saving").length).toBeGreaterThan(0);
    });

    it("draws and clears a keep area from the keyboard", () => {
      render_({ view });
      expect(screen.queryByTestId("keep-area")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Move keep area instead" }));
      const picture = screen.getByRole("group", { name: /default cover picture/ });
      fireEvent.keyDown(picture, { key: "ArrowRight" });
      expect(screen.getByTestId("keep-area")).toBeInTheDocument();
      fireEvent.keyDown(picture, { key: "Delete" });
      expect(screen.queryByTestId("keep-area")).not.toBeInTheDocument();
    });

    it("applies a tone override to the previews and saves only what changed", async () => {
      render_({ view });
      fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
      expect(guard()).toBe("true");
      fireEvent.click(saveButton());
      await waitFor(() => expect(save).toHaveBeenCalled());
      const plan = save.mock.calls[0]?.[1];
      expect(plan.puts).toHaveLength(1);
      expect(plan.puts[0]).toMatchObject({ name: "default", body: { toneOverride: "dark" } });
      expect(plan.home).toBeNull();
    });

    it("warns when the sale title is long for the cover", () => {
      render_({ view, saleTitle: "Modern British and Irish Art, Works on Paper and Sculpture" });
      expect(screen.getByText(/The sale title is \d+ characters/)).toBeInTheDocument();
    });
  });

  describe("pending and failed", () => {
    it("says the picture is being analysed and keeps reading the sale until it is done", () => {
      vi.useFakeTimers();
      try {
        render_({
          view: coverView({ slots: { default: slotView("default", storedSlot(), "pending") } }),
        });
        expect(screen.getAllByText("Analysing…").length).toBeGreaterThan(1);
        vi.advanceTimersByTime(4100);
        expect(router.refresh).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not wait for a phone slot, which is never measured", () => {
      vi.useFakeTimers();
      try {
        render_({
          view: coverView({
            slots: {
              default: slotView("default", storedSlot()),
              phone: slotView(
                "phone",
                storedSlot({ key: "covers/p.jpg", width: 1400, height: 1400 }),
                "pending",
              ),
            },
          }),
        });
        vi.advanceTimersByTime(9000);
        expect(router.refresh).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("says when a picture could not be measured", () => {
      render_({
        view: coverView({ slots: { default: slotView("default", storedSlot(), "failed") } }),
      });
      expect(screen.getAllByText("Could not be measured")).toHaveLength(2);
    });
  });

  describe("old cover list", () => {
    it("explains a slot that still holds a picture from the old list", () => {
      render_({
        view: coverView({
          slots: {
            default: {
              source: "legacy",
              legacyKey: "old/a.jpg",
              issues: [],
              analysis: { status: "pending", value: null },
            },
          },
        }),
      });
      expect(
        screen.getByText("This slot still shows a picture from the old cover list"),
      ).toBeInTheDocument();
      expect(screen.getAllByTestId("preview-legacy")).toHaveLength(3);
    });
  });

  describe("home pin", () => {
    const pins = [
      { saleId: OTHER_SALE, title: "Modern Masters", position: 1 },
      { saleId: "33333333-3333-4333-8333-333333333333", title: "Hybrid Day Sale", position: 2 },
      { saleId: "44444444-4444-4444-8444-444444444444", title: "Press Archive", position: 3 },
    ];

    it("cannot take a fourth place and names the sales that hold them", () => {
      render_({ view: coverView({ pins }) });
      const pin = screen.getByRole("checkbox", { name: /Pin to the home hero/ });
      expect(pin).toBeDisabled();
      expect(
        screen.getByText(
          /3 sales are already pinned \(Modern Masters, Hybrid Day Sale, Press Archive\)/,
        ),
      ).toBeInTheDocument();
    });

    it("keeps a draft sale off the home page", () => {
      render_({ saleStatus: "draft" });
      expect(screen.getByRole("checkbox", { name: /Pin to the home hero/ })).toBeDisabled();
      expect(
        screen.getByText("Only a published sale can be pinned to the home page."),
      ).toBeInTheDocument();
    });

    it("pins after the sales already pinned", async () => {
      render_({ view: coverView({ pins: [pins[0] as (typeof pins)[number]] }) });
      fireEvent.click(screen.getByRole("checkbox", { name: /Pin to the home hero/ }));
      fireEvent.click(saveButton());
      await waitFor(() => expect(save).toHaveBeenCalled());
      expect(save.mock.calls[0]?.[1].pins).toEqual([OTHER_SALE, SALE_ID]);
    });
  });

  describe("featured lots", () => {
    const view = coverView({
      home: {
        subtitle: null,
        featuredLotIds: [LOTS[0]?.id as string, LOTS[1]?.id as string],
        consignmentDeadline: null,
        homePinOrder: null,
      },
    });

    it("lists the lots in order with their sizes and counts them", () => {
      render_({ view });
      const list = screen.getByRole("list", { name: "Featured lots" });
      const rows = within(list).getAllByRole("listitem");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent("Lot 1 · Harbour at First Light");
      expect(rows[0]).toHaveTextContent("size 60 × 80 cm");
      expect(screen.getByText("2 of 12")).toBeInTheDocument();
    });

    it("reorders with the buttons and saves the new order", async () => {
      render_({ view });
      fireEvent.click(screen.getAllByRole("button", { name: /Move .* down/ })[0] as HTMLElement);
      const rows = within(screen.getByRole("list", { name: "Featured lots" })).getAllByRole(
        "listitem",
      );
      expect(rows[0]).toHaveTextContent("Lot 2");
      fireEvent.click(saveButton());
      await waitFor(() => expect(save).toHaveBeenCalled());
      expect(save.mock.calls[0]?.[1].home).toEqual({ featuredLotIds: [LOTS[1]?.id, LOTS[0]?.id] });
    });

    it("removes a lot from the list", () => {
      render_({ view });
      fireEvent.click(screen.getAllByRole("button", { name: /Remove/ })[0] as HTMLElement);
      expect(screen.getByText("1 of 12")).toBeInTheDocument();
    });

    it("flags a lot that is no longer in the sale so it can be removed", () => {
      render_({
        view: coverView({
          home: { ...view.home, featuredLotIds: ["99999999-9999-4999-8999-999999999999"] },
        }),
      });
      expect(screen.getByText("This lot is no longer in the sale")).toBeInTheDocument();
    });

    it("stops at twelve lots", () => {
      const many = Array.from(
        { length: 12 },
        (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      );
      render_({ view: coverView({ home: { ...view.home, featuredLotIds: many } }) });
      expect(screen.getByText("12 of 12")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Add a lot" })).toBeDisabled();
    });
  });

  describe("errors and the unsaved guard", () => {
    it("keeps the changes and says what was refused when the save fails", async () => {
      save.mockResolvedValue({
        ok: false,
        error: "The default cover was not saved: That picture is still being processed.",
      });
      render_({ view: coverView({ slots: { default: slotView("default", storedSlot()) } }) });
      fireEvent.change(screen.getByRole("textbox", { name: /Subtitle/ }), {
        target: { value: "A line of fact" },
      });
      fireEvent.click(saveButton());
      const banner = await screen.findByRole("alert");
      expect(banner).toHaveTextContent("Your changes were not saved");
      expect(banner).toHaveTextContent("still being processed");
      expect(guard()).toBe("true");
      expect(notify.success).not.toHaveBeenCalled();
      expect(router.refresh).toHaveBeenCalled();
    });

    it("discards changes back to what was saved", () => {
      render_({ view: coverView({ slots: { default: slotView("default", storedSlot()) } }) });
      fireEvent.change(screen.getByRole("textbox", { name: /Subtitle/ }), {
        target: { value: "x" },
      });
      expect(guard()).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
      expect(guard()).toBe("false");
      expect(screen.getByRole("textbox", { name: /Subtitle/ })).toHaveValue("");
    });
  });

  describe("read only", () => {
    const view = coverView({
      slots: { default: slotView("default", storedSlot()) },
      home: {
        subtitle: "Shown under the title",
        featuredLotIds: [LOTS[0]?.id as string],
        consignmentDeadline: null,
        homePinOrder: null,
      },
    });

    it("shows everything without a way to change it", () => {
      render_({ view, canEdit: false });
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Move keep area instead" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Auto · white, 0.45")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Discard changes" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("checkbox", { name: /Pin to the home hero/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("img", { name: "No" })).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Add a lot" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Move .* down/ })).not.toBeInTheDocument();
      expect(screen.getByTestId("preview-desktop")).toBeInTheDocument();
    });
  });
});

describe("SaleCoverSkeleton", () => {
  afterEach(cleanup);

  it("announces that the cover is loading", () => {
    render(<SaleCoverSkeleton />);
    const loading = screen.getByLabelText("Loading the cover and home settings");
    expect(loading).toHaveAttribute("aria-busy", "true");
  });
});
