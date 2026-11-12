// @vitest-environment jsdom
import type { AdminHomeCover, AdminHomeCoverPictureCandidate } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);
vi.mock("@auction/ui/components/tooltip", async () =>
  (await import("@/test/radix-stubs")).tooltipStub(),
);
vi.mock("@auction/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

(await import("@/test/radix-stubs")).installLayoutStubs();
const { HomeCoverSection } = await import("./home-cover-section.client");

const savedCover: NonNullable<AdminHomeCover["cover"]> = {
  mediaKey: "shop/artwork/a.jpg",
  imageUrl: "https://media.test/shop/artwork/a.jpg",
  width: 3200,
  height: 1600,
  alt: "A river at dusk",
  focal: { x: 0.7, y: 0.4 },
  side: "left",
  tone: "light",
  updatedAt: "2026-11-12T10:00:00.000Z",
};
const NONE: AdminHomeCover = { cover: null, minimumWidth: 2400 };
const WITH_COVER: AdminHomeCover = { cover: savedCover, minimumWidth: 2400 };
const candidate: AdminHomeCoverPictureCandidate = {
  mediaKey: "shop/artwork/b.jpg",
  imageUrl: "https://media.test/shop/artwork/b.jpg",
  artworkTitle: "Vessel Study",
  artistName: "Flora Powers",
};

function actions(over: Partial<Parameters<typeof HomeCoverSection>[0]["actions"]> = {}) {
  return {
    search: vi.fn(async () => [candidate]),
    save: vi.fn(async () => ({ ok: true as const, data: WITH_COVER })),
    remove: vi.fn(async () => ({ ok: true as const, data: NONE })),
    ...over,
  };
}

async function choosePicture() {
  fireEvent.click(screen.getByRole("combobox", { name: "Choose a Shop picture" }));
  fireEvent.click(await screen.findByRole("option", { name: /Vessel Study/ }));
  return screen.findByRole("textbox", { name: /Alt text/ });
}

beforeEach(() => {
  toastSuccess.mockReset();
});

describe("HomeCoverSection", () => {
  it("says what the home does when there is no cover, with no controls for read-only staff", () => {
    render(<HomeCoverSection saved={NONE} />);
    expect(
      screen.getByText("No cover image is set. The home leads with the newest release."),
    ).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows read-only staff the saved cover, its words and where the headline sits", () => {
    render(<HomeCoverSection saved={WITH_COVER} />);
    expect(screen.getByText("In use")).toBeInTheDocument();
    expect(screen.getByText("A river at dusk")).toBeInTheDocument();
    expect(screen.getByText("The headline sits on the left, in white type.")).toBeInTheDocument();
    expect(screen.getByText("3200 × 1600 px")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save cover image" })).not.toBeInTheDocument();
  });

  it("offers a Shop picture or an upload when nothing is chosen", () => {
    render(<HomeCoverSection saved={NONE} actions={actions()} />);
    expect(screen.getByRole("combobox", { name: "Choose a Shop picture" })).toBeInTheDocument();
    expect(screen.getByText("Upload a picture")).toBeInTheDocument();
    expect(screen.getByText(/at least 2400 px wide/)).toBeInTheDocument();
  });

  it("starts from the edition's words, then saves the picture, the point and the alt text", async () => {
    const calls = actions();
    const onSaved = vi.fn();
    render(<HomeCoverSection saved={NONE} actions={calls} onSaved={onSaved} />);

    const alt = await choosePicture();
    expect(alt).toHaveValue("Vessel Study, by Flora Powers");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(
      screen.getByText("The headline is checked against the picture when you save."),
    ).toBeInTheDocument();

    fireEvent.change(alt, { target: { value: "  A glazed vessel  " } });
    fireEvent.keyDown(screen.getByRole("application"), { key: "ArrowRight", shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Save cover image" }));

    await waitFor(() =>
      expect(calls.save).toHaveBeenCalledWith({
        mediaKey: "shop/artwork/b.jpg",
        alt: "A glazed vessel",
        focal: { x: 0.55, y: 0.5 },
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Cover image saved"));
    expect(onSaved).toHaveBeenCalledWith(WITH_COVER);
    expect(screen.getByText("In use")).toBeInTheDocument();
    expect(screen.getByText("The headline sits on the left, in white type.")).toBeInTheDocument();
  });

  it("does not save without alt text, and says so in the summary and beside the field", async () => {
    const calls = actions();
    render(<HomeCoverSection saved={NONE} actions={calls} />);
    const alt = await choosePicture();
    fireEvent.change(alt, { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save cover image" }));

    expect(await screen.findByText("Fix this before saving")).toBeInTheDocument();
    expect(screen.getAllByText("Describe the picture in a few words.")).toHaveLength(2);
    expect(calls.save).not.toHaveBeenCalled();
  });

  it("marks the picture when the server says it is too small, and keeps what was entered", async () => {
    const calls = actions({
      save: vi.fn(async () => ({
        ok: false as const,
        kind: "validation" as const,
        message: "The picture is too small for the cover. Nothing was saved.",
        issues: [{ field: "mediaKey", reason: "picture_too_narrow" }],
      })),
    });
    render(<HomeCoverSection saved={NONE} actions={calls} />);
    const alt = await choosePicture();
    fireEvent.click(screen.getByRole("button", { name: "Save cover image" }));

    expect(await screen.findAllByText(/The cover needs at least 2400 px/)).not.toHaveLength(0);
    expect(alt).toHaveValue("Vessel Study, by Flora Powers");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows a refusal that names no field as a notice", async () => {
    const calls = actions({
      save: vi.fn(async () => ({ ok: false as const, kind: "forbidden" as const })),
    });
    render(<HomeCoverSection saved={NONE} actions={calls} />);
    await choosePicture();
    fireEvent.click(screen.getByRole("button", { name: "Save cover image" }));
    expect(
      await screen.findByText("You do not have permission for this action."),
    ).toBeInTheDocument();
  });

  it("discards edits back to the saved cover", async () => {
    render(<HomeCoverSection saved={WITH_COVER} actions={actions()} />);
    const alt = screen.getByRole("textbox", { name: /Alt text/ });
    expect(screen.getByRole("button", { name: "Save cover image" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.change(alt, { target: { value: "A weir" } });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByRole("textbox", { name: /Alt text/ })).toHaveValue("A river at dusk");
    expect(screen.getByText("In use")).toBeInTheDocument();
  });

  it("goes back to choosing when staff want another picture", () => {
    render(<HomeCoverSection saved={WITH_COVER} actions={actions()} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose another picture" }));
    expect(screen.getByRole("combobox", { name: "Choose a Shop picture" })).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("removes the cover only after confirming what will happen", async () => {
    const calls = actions();
    render(<HomeCoverSection saved={WITH_COVER} actions={calls} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove cover image" }));
    expect(
      screen.getByText(/The Shop home will lead with the newest release again, at once/),
    ).toBeInTheDocument();
    expect(calls.remove).not.toHaveBeenCalled();

    const buttons = screen.getAllByRole("button", { name: "Remove cover image" });
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(calls.remove).toHaveBeenCalledOnce());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Cover image removed"));
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Choose a Shop picture" })).toBeInTheDocument();
  });
});
