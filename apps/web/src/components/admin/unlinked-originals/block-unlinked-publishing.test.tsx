import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlockUnlinkedPublishing } from "./block-unlinked-publishing";

const refresh = vi.fn();
const setBlock = vi.fn();
const success = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/admin/unlinked-originals/unlinked-originals.actions", () => ({
  setBlockUnlinkedPublishingAction: (next: boolean) => setBlock(next),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: (m: string) => success(m) } }));

beforeEach(() => {
  vi.clearAllMocks();
  setBlock.mockResolvedValue({ ok: true });
});

const toggle = () => screen.getByRole("switch", { name: /block publishing unlinked originals/i });

describe("BlockUnlinkedPublishing", () => {
  it("is off with a hint to finish the report first while originals are unlinked", () => {
    render(<BlockUnlinkedPublishing enabled={false} canEdit unlinked={3} />);
    expect(toggle()).not.toBeChecked();
    expect(screen.getByText(/turn it on once every live original below is linked/i)).toBeTruthy();
  });

  it("says it is safe to turn on when nothing is unlinked", () => {
    render(<BlockUnlinkedPublishing enabled={false} canEdit unlinked={0} />);
    expect(
      screen.getByText(/every live original is linked, so it is safe to turn on/i),
    ).toBeTruthy();
  });

  it("turns on, tells staff, and refreshes the report", async () => {
    render(<BlockUnlinkedPublishing enabled={false} canEdit unlinked={0} />);
    fireEvent.click(toggle());
    await waitFor(() => expect(setBlock).toHaveBeenCalledWith(true));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(success).toHaveBeenCalledWith(
      "Unlinked originals can no longer be published in LAX Bid",
    );
  });

  it("keeps a failure in the section and does not refresh", async () => {
    setBlock.mockResolvedValue({ ok: false, error: "We couldn't save this setting. Try again." });
    render(<BlockUnlinkedPublishing enabled={false} canEdit unlinked={0} />);
    fireEvent.click(toggle());
    expect(await screen.findByText("We couldn't save this setting. Try again.")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("is read-only for staff who are not administrators, and says so", () => {
    render(<BlockUnlinkedPublishing enabled canEdit={false} unlinked={0} />);
    expect(toggle()).toBeDisabled();
    expect(screen.getByText(/only an administrator can change it/i)).toBeTruthy();
  });
});
