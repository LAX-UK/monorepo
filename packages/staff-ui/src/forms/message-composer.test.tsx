import { TooltipProvider } from "@auction/ui/components/tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { MessageComposer, type MessageComposerProps } from "./message-composer.js";

function renderComposer(overrides: Partial<MessageComposerProps> = {}) {
  const props: MessageComposerProps = {
    mode: "reply",
    onModeChange: vi.fn(),
    value: "Yes, the date is fixed.",
    onValueChange: vi.fn(),
    onSubmit: vi.fn(),
    placeholder: "Write to Northbank Gallery…",
    recipients: "Lena Fischer, and Northbank Gallery's owners and admins, by email and in Bid.",
    sendLabel: "Send to Northbank Gallery",
    ...overrides,
  };
  const wrap = (node: React.ReactNode) => <TooltipProvider>{node}</TooltipProvider>;
  return { props, ...render(wrap(<MessageComposer {...props} />)) };
}

describe("MessageComposer", () => {
  it("names who hears of a reply and on the send button", () => {
    renderComposer();
    expect(screen.getByText(/Lena Fischer, and Northbank Gallery/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Send to Northbank Gallery/ })).toBeTruthy();
  });

  it("turns into a note that says no one is notified and adds rather than sends", () => {
    renderComposer({ mode: "note" });
    expect(screen.getByText("Visible to Bid staff only. No one is notified.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add note" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Internal note" })).toBeTruthy();
  });

  it("sends on mod+Enter", () => {
    const { props } = renderComposer();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Reply" }), {
      key: "Enter",
      metaKey: true,
    });
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("holds Send while it is blocked and says why", () => {
    const { props } = renderComposer({ sendBlockedReason: "Wait until the files are checked" });
    const send = screen.getByRole("button", { name: /Send to Northbank Gallery/ });
    expect(send.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(send);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Reply" }), {
      key: "Enter",
      ctrlKey: true,
    });
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("shows Sending… and ignores repeat presses while a reply is on its way", () => {
    const { props } = renderComposer({ sending: true });
    const send = screen.getByRole("button", { name: /Sending/ });
    fireEvent.click(send);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("lists files, with progress, a rejected one in words, and a way to remove each", () => {
    const onRemove = vi.fn();
    renderComposer({
      onAttach: vi.fn(),
      onRemoveAttachment: onRemove,
      attachments: [
        { id: "1", name: "print-schedule.pdf", kind: "pdf", size: "340 KB" },
        { id: "2", name: "wall-view.jpg", kind: "image", progress: 0.4 },
        { id: "3", name: "gallery-scan.tif", kind: "image", error: "TIFF isn't accepted" },
      ],
      attachmentError: "gallery-scan.tif is 32 MB and TIFF isn't accepted.",
    });
    expect(screen.getByText("wall-view.jpg").closest("li")?.textContent).toContain(
      "Uploading, 40%",
    );
    expect(screen.getByText("gallery-scan.tif is 32 MB and TIFF isn't accepted.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove print-schedule.pdf" }));
    expect(onRemove).toHaveBeenCalledWith("1");
  });

  it("switches mode through the segmented control", () => {
    const { props } = renderComposer();
    fireEvent.click(screen.getByRole("radio", { name: /Internal note/ }));
    expect(props.onModeChange).toHaveBeenCalledWith("note");
  });
});
