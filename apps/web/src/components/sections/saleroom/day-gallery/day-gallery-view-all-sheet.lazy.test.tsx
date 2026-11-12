import { LazyDayGalleryViewAllSheet } from "@/components/sections/saleroom/day-gallery/day-gallery-view-all-sheet.lazy";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

/** The sheet's chunk: refused while `fail` is set. */
const chunk = vi.hoisted(() => ({ fail: true, loads: 0 }));

vi.mock("@/components/sections/saleroom/day-gallery/day-gallery-view-all-sheet", () => ({
  get DayGalleryViewAllSheet() {
    chunk.loads += 1;
    if (chunk.fail) throw new Error("chunk failed");
    return ({ open }: { open: boolean }) =>
      open ? <div role="dialog" aria-label="All media" /> : null;
  },
}));

function Harness({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        View all
      </button>
      {mounted ? (
        <LazyDayGalleryViewAllSheet
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
          items={[]}
          saleTitle="Autumn Sale"
          onSelectIndex={() => {}}
        />
      ) : null}
    </>
  );
}

describe("LazyDayGalleryViewAllSheet when the sheet cannot be fetched", () => {
  it("undoes the press instead of failing the page, and fetches again on the next press", async () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(chunk.loads).toBe(1);

    chunk.fail = false;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "View all" }));
    });

    expect(await screen.findByRole("dialog", { name: "All media" })).toBeInTheDocument();
    expect(chunk.loads).toBe(2);
  });
});
