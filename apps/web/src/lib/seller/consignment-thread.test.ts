import { describe, expect, it } from "vitest";
import {
  type ConsignmentMessage,
  fileSize,
  messageRows,
  messageTime,
  parseConsignmentThread,
  threadCounterpart,
} from "./consignment-thread";

const NOW = new Date("2026-10-29T15:00:00Z");

function message(
  id: string,
  side: "client" | "staff",
  name: string,
  createdAt: string,
  extra: Partial<ConsignmentMessage> = {},
): ConsignmentMessage {
  return {
    id,
    side,
    author: { userId: name.toLowerCase(), name },
    body: "Hello",
    createdAt,
    readAt: null,
    attachments: [],
    ...extra,
  };
}

describe("messageRows", () => {
  it("names the specialist's role on their first message only, and marks the account's own", () => {
    const rows = messageRows(
      [
        message("1", "staff", "Clara Mendes", "2026-10-27T09:00:00Z"),
        message("2", "client", "Lena Fischer", "2026-10-28T09:00:00Z", {
          attachments: [
            {
              id: "a",
              fileName: "frame-label.jpg",
              contentType: "image/jpeg",
              byteSize: 2_400_000,
              url: "/f/a",
            },
          ],
        }),
        message("3", "staff", "Clara Mendes", "2026-10-29T14:05:00Z"),
      ],
      NOW,
    );
    expect(rows.map((r) => [r.who, r.time, r.mine, r.initials])).toEqual([
      ["Clara Mendes · Specialist", "27 Oct", false, "CM"],
      ["Lena Fischer", "28 Oct", true, "LF"],
      ["Clara Mendes", "14:05", false, "CM"],
    ]);
    expect(rows[1]?.attachments[0]).toMatchObject({ kind: "image", size: "2.3 MB" });
  });
});

describe("message times and sizes", () => {
  it("shows the time today, the day this year, and the year before that", () => {
    expect(messageTime(new Date("2026-10-29T08:30:00Z"), NOW)).toBe("08:30");
    expect(messageTime(new Date("2026-03-02T08:30:00Z"), NOW)).toBe("2 Mar");
    expect(messageTime(new Date("2025-12-24T08:30:00Z"), NOW)).toBe("24 Dec 2025");
  });

  it("reads file sizes in KB and MB", () => {
    expect(fileSize(830_000)).toBe("811 KB");
    expect(fileSize(null)).toBeNull();
  });
});

describe("the thread's words", () => {
  it("names the specialist when one is assigned", () => {
    expect(threadCounterpart({ specialist: { name: "Clara Mendes" } })).toEqual({
      heading: "Messages with Clara Mendes",
      empty: "No messages yet. Ask Clara Mendes anything about this work.",
      placeholder: "Write to Clara…",
    });
    expect(threadCounterpart({ specialist: null }).heading).toBe("Messages with your specialist");
  });

  it("parses the API's thread and refuses another shape", () => {
    const thread = parseConsignmentThread({
      data: {
        submissionId: "s1",
        specialist: null,
        messages: [],
        unread: 0,
        access: { canWrite: false, reason: "Your role can read these messages." },
      },
    });
    expect(thread?.access.canWrite).toBe(false);
    expect(parseConsignmentThread({ data: { messages: "no" } })).toBeNull();
  });
});
