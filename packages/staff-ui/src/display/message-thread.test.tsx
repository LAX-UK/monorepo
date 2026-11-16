import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageThread, type ThreadItem } from "./message-thread.js";

const time = { label: "29 Oct, 16:40", dateTime: "2026-10-29T16:40:00.000Z", full: "Thursday" };

const items: ThreadItem[] = [
  {
    type: "event",
    id: "e1",
    icon: "assigned",
    text: "Assigned to Clara Mendes",
    time,
  },
  { type: "day", id: "d1", label: "29 October" },
  {
    type: "message",
    id: "m1",
    author: { name: "Clara Mendes", initials: "CM", role: "Specialist", side: "staff" },
    time,
    body: "The agreement is ready.",
    attachments: [],
    receipt: "Read by Northbank Gallery · 29 Oct, 17:02",
  },
  {
    type: "message",
    id: "m2",
    author: { name: "Clara Mendes", initials: "CM", side: "staff" },
    note: true,
    time,
    body: "Label matches the stock book.",
    attachments: [],
  },
  { type: "new", id: "n1" },
  {
    type: "message",
    id: "m3",
    author: {
      name: "Lena Fischer",
      initials: "LF",
      role: "Northbank Gallery, consignor",
      side: "client",
    },
    time,
    body: "Is the date fixed?",
    attachments: [
      { id: "a1", name: "frame-label.jpg", href: "/f.jpg", kind: "image", size: "2.1 MB" },
    ],
  },
];

describe("MessageThread", () => {
  it("is a named log of every item in order", () => {
    render(<MessageThread items={items} label="Messages with Northbank Gallery" />);
    const log = screen.getByRole("log", { name: "Messages with Northbank Gallery" });
    expect(log.getAttribute("aria-live")).toBe("polite");
    expect(within(log).getByText("Assigned to Clara Mendes", { exact: false })).toBeTruthy();
    expect(within(log).getByText("29 October")).toBeTruthy();
    expect(within(log).getByLabelText("New messages")).toBeTruthy();
    expect(within(log).getByText("frame-label.jpg")).toBeTruthy();
  });

  it("marks an internal note in words, not only by its border", () => {
    render(<MessageThread items={items} label="Thread" />);
    const note = screen.getByText("Label matches the stock book.").closest("li");
    expect(note?.textContent).toContain("Internal note");
    expect(note?.textContent).toContain("only staff can see this");
  });

  it("shows the read receipt under the reply the client read", () => {
    render(<MessageThread items={items} label="Thread" />);
    expect(screen.getByText("Read by Northbank Gallery · 29 Oct, 17:02")).toBeTruthy();
  });

  it("keeps a failed reply's text with Retry and Edit", () => {
    const onRetry = vi.fn();
    const onEdit = vi.fn();
    render(
      <MessageThread
        label="Thread"
        items={[
          {
            type: "message",
            id: "f1",
            author: { name: "Clara Mendes", initials: "CM", side: "staff" },
            time,
            body: "Yes, 19 November is fixed.",
            attachments: [],
            delivery: {
              state: "failed",
              message: "Not sent. Check your connection.",
              onRetry,
              onEdit,
            },
          },
        ]}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Not sent");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onRetry).toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalled();
    expect(screen.getByText("Yes, 19 November is fixed.")).toBeTruthy();
  });

  it("says a reply is sending in place of its time", () => {
    render(
      <MessageThread
        label="Thread"
        items={[
          {
            type: "message",
            id: "s1",
            author: { name: "Clara Mendes", initials: "CM", side: "staff" },
            time,
            body: "On its way",
            attachments: [],
            delivery: { state: "sending" },
          },
        ]}
      />,
    );
    expect(screen.getByText("Sending…")).toBeTruthy();
    expect(screen.queryByText("29 Oct, 16:40")).toBeNull();
  });

  it("folds older messages behind one button", () => {
    const onShow = vi.fn();
    render(<MessageThread items={items} label="Thread" earlier={{ count: 14, onShow }} />);
    fireEvent.click(screen.getByRole("button", { name: "Show 14 earlier messages" }));
    expect(onShow).toHaveBeenCalled();
  });

  it("shows the empty state when there is nothing yet", () => {
    render(<MessageThread items={[]} label="Thread" empty={<p>No messages yet</p>} />);
    expect(screen.getByText("No messages yet")).toBeTruthy();
    expect(screen.queryByRole("log")).toBeNull();
  });
});

describe("MessageThread messages from outside the product", () => {
  const emailed: ThreadItem = {
    type: "message",
    id: "m9",
    author: { name: "Sam Sender", initials: "SS", role: "Client", side: "client" },
    time,
    body: "Tuesday works.",
    attachments: [],
    channel: "via email",
    files: [{ id: "f1", name: "photo.jpg", detail: "JPEG image · 2 KB", kind: "image" }],
    filesNote: "The files themselves were not kept.",
  };

  it("says how the message arrived and lists named files without a link", () => {
    render(<MessageThread items={[emailed]} label="Replies" />);
    const log = screen.getByRole("log", { name: "Replies" });
    expect(within(log).getByText("via email")).toBeTruthy();
    const files = within(log).getByRole("list", { name: "Files named in this message" });
    expect(within(files).getByText("photo.jpg")).toBeTruthy();
    expect(within(log).getByText("The files themselves were not kept.")).toBeTruthy();
    expect(within(log).queryByRole("link")).toBeNull();
  });
});

describe("MessageThread inside a longer page", () => {
  it("leaves out the floating jump control when asked", () => {
    const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    const original = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observers.push(callback);
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
    try {
      render(<MessageThread items={items} label="Embedded" jumpToLatest={false} />);
      act(() => {
        for (const notify of observers) notify([{ isIntersecting: false }]);
      });
      expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();
    } finally {
      globalThis.IntersectionObserver = original;
    }
  });
});
