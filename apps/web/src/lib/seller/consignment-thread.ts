import { initials } from "@/components/organisations/initials";
import { z } from "zod";

/**
 * A consignment's messages as the account reads them (`GET /submissions/:id/messages`), and how
 * each message reads in the thread.
 */
const attachment = z.object({
  id: z.string(),
  fileName: z.string(),
  contentType: z.string().nullable(),
  byteSize: z.number().nullable(),
  url: z.string(),
});

export const consignmentMessageSchema = z.object({
  id: z.string(),
  side: z.enum(["client", "staff"]),
  author: z.object({ userId: z.string().nullable(), name: z.string() }),
  body: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
  attachments: z.array(attachment),
});

const threadSchema = z.object({
  submissionId: z.string(),
  specialist: z.object({ name: z.string() }).nullable(),
  messages: z.array(consignmentMessageSchema),
  unread: z.number().int().nonnegative(),
  access: z.object({ canWrite: z.boolean(), reason: z.string().nullable() }),
});

export type ConsignmentMessage = z.infer<typeof consignmentMessageSchema>;
export type ConsignmentMessageAttachment = z.infer<typeof attachment>;
export type ConsignmentThread = z.infer<typeof threadSchema>;

/** The thread from an API body (`{ data }`), or `null` when it is not that shape. */
export function parseConsignmentThread(body: unknown): ConsignmentThread | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = threadSchema.safeParse((body as { data: unknown }).data);
  return parsed.success ? parsed.data : null;
}

/** One message from an API body (`{ data }`), or `null`. */
export function parseConsignmentMessage(body: unknown): ConsignmentMessage | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = consignmentMessageSchema.safeParse((body as { data: unknown }).data);
  return parsed.success ? parsed.data : null;
}

const ZONE = "Europe/London";
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: ZONE });
const DAY_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ZONE,
});
const FULL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});
const YEAR = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: ZONE });

/** When a message was sent: the time today ("14:02"), the day this year ("27 Oct"), or with the year. */
export function messageTime(at: Date, now: Date): string {
  if (DAY_YEAR.format(at) === DAY_YEAR.format(now)) return TIME.format(at);
  return YEAR.format(at) === YEAR.format(now) ? DAY.format(at) : DAY_YEAR.format(at);
}

/** The full date and time, for the time element's title. */
export function messageFullTime(at: Date): string {
  return FULL.format(at);
}

/** "2.4 MB", "830 KB": a file's size on its attachment line. */
export function fileSize(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type MessageRowView = {
  id: string;
  /** The account's own messages sit on the selected tint; the specialist's on the sunken one. */
  mine: boolean;
  initials: string;
  /** "Clara Mendes · Specialist": the role only on a specialist's first message. */
  who: string;
  /** "27 Oct", or the time today. */
  time: string;
  dateTime: string;
  fullTime: string;
  body: string;
  attachments: Array<ConsignmentMessageAttachment & { kind: "image" | "pdf"; size: string | null }>;
};

/** The thread's rows: who wrote, when, and the specialist's role the first time they write. */
export function messageRows(messages: readonly ConsignmentMessage[], now: Date): MessageRowView[] {
  const introduced = new Set<string>();
  return messages.map((message) => {
    const at = new Date(message.createdAt);
    const key = message.author.userId ?? message.author.name;
    const role = message.side === "staff" && !introduced.has(key) ? "Specialist" : null;
    if (message.side === "staff") introduced.add(key);
    return {
      id: message.id,
      mine: message.side === "client",
      initials: initials(message.author.name),
      who: role ? `${message.author.name} · ${role}` : message.author.name,
      time: messageTime(at, now),
      dateTime: at.toISOString(),
      fullTime: messageFullTime(at),
      body: message.body,
      attachments: message.attachments.map((file) => ({
        ...file,
        kind: file.contentType === "application/pdf" ? "pdf" : "image",
        size: fileSize(file.byteSize),
      })),
    };
  });
}

/** Who the thread is with, for its heading and empty state. */
export function threadCounterpart(thread: Pick<ConsignmentThread, "specialist">): {
  heading: string;
  empty: string;
  placeholder: string;
} {
  const name = thread.specialist?.name ?? null;
  return name
    ? {
        heading: `Messages with ${name}`,
        empty: `No messages yet. Ask ${name} anything about this work.`,
        placeholder: `Write to ${name.split(" ")[0]}…`,
      }
    : {
        heading: "Messages with your specialist",
        empty: "No messages yet. Ask our specialists anything about this work.",
        placeholder: "Write to your specialist…",
      };
}
