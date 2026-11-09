import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLotQuickLook } from "./lot-quick-look-context";
import { MarketingLotQuickLookShell } from "./marketing-lot-quick-look-shell";
import type { LotQuickLookVM } from "./types";

const loaded = vi.hoisted(() => ({ count: 0 }));

vi.mock("./lot-quick-look-dialog", () => {
  loaded.count += 1;
  return { LotQuickLookDialog: () => <div role="dialog" aria-label="Quick look" /> };
});

const vm = { id: "lot-1", title: "Abstract in cobalt" } as unknown as LotQuickLookVM;

function OpenButton() {
  const { openQuickLook } = useLotQuickLook();
  return (
    <button type="button" onClick={() => openQuickLook(vm, { deckSourceLabel: "Sale" } as never)}>
      Open
    </button>
  );
}

describe("MarketingLotQuickLookShell", () => {
  it("leaves the dialog out of the page until a quick look is opened", async () => {
    render(
      <MarketingLotQuickLookShell>
        <OpenButton />
      </MarketingLotQuickLookShell>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(loaded.count).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog", { name: "Quick look" })).toBeInTheDocument();
    expect(loaded.count).toBe(1);
  });
});
