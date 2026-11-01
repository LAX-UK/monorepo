import type { ConsignmentMessageRow } from "@auction/persistence/interfaces";
import { bidStaffRoleLabel, normalizeStaffRoles, primaryStaffRole } from "@auction/types";
import type { ConsignmentThreadMessageView } from "@auction/validators";
import type { IAttachmentLinks } from "./consignment-message.ports.js";
import type { ConsignmentMessageView } from "./consignment-message.ports.js";

/** A readable name when the sender's device gave none: "Photo.jpg", "Document.pdf". */
function fileNameFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  return ext === "pdf" ? "Document.pdf" : ext ? `Photo.${ext}` : "File";
}

/** "buyer_agent" as people say it: "buyer agent". */
export function memberRoleWords(role: string): string {
  return role.replaceAll("_", " ").toLowerCase();
}

/**
 * Who wrote, as staff read it: a client's place in their account ("Northbank Gallery,
 * consignor"), or a colleague's role ("Specialist").
 */
export function authorRoleLine(
  row: Pick<
    ConsignmentMessageRow,
    "authorSide" | "authorUserId" | "authorMemberRole" | "authorStaffRoles"
  >,
  accountName: string | null,
): string | null {
  if (row.authorSide === "client") {
    if (!row.authorUserId || !accountName) return null;
    return row.authorMemberRole
      ? `${accountName}, ${memberRoleWords(row.authorMemberRole)}`
      : accountName;
  }
  const primary = primaryStaffRole(normalizeStaffRoles(row.authorStaffRoles));
  return primary ? bidStaffRoleLabel(primary) : null;
}

export type StaffViewContext = {
  viewerUserId: string;
  accountName: string | null;
  now: Date;
};

/** Turns stored messages into what each reader sees: attachments linked, names filled. */
export class ConsignmentMessagePresenter {
  constructor(private readonly links: IAttachmentLinks) {}

  async forClient(rows: readonly ConsignmentMessageRow[]): Promise<ConsignmentMessageView[]> {
    const attachments = await this.attachmentsOf(rows);
    return rows.map((row) => ({
      id: row.id,
      side: row.authorSide,
      author: { userId: row.authorUserId, name: authorName(row) },
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt ? row.readAt.toISOString() : null,
      attachments: attachments.get(row.id) ?? [],
    }));
  }

  async forStaff(
    rows: readonly ConsignmentMessageRow[],
    context: StaffViewContext,
  ): Promise<ConsignmentThreadMessageView[]> {
    const attachments = await this.attachmentsOf(rows);
    return rows.map((row) => {
      const held = row.deliverAfter !== null && row.deliverAfter.getTime() > context.now.getTime();
      return {
        id: row.id,
        side: row.authorSide,
        visibility: row.visibility,
        author: {
          userId: row.authorUserId,
          name: authorName(row),
          role: authorRoleLine(row, context.accountName),
        },
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        readAt: row.visibility === "internal" || !row.readAt ? null : row.readAt.toISOString(),
        // Only the writer can take a reply back, and only while it is held.
        undoUntil:
          held && row.authorUserId === context.viewerUserId && row.deliverAfter
            ? row.deliverAfter.toISOString()
            : null,
        attachments: attachments.get(row.id) ?? [],
      };
    });
  }

  private async attachmentsOf(rows: readonly ConsignmentMessageRow[]) {
    const keys = rows.flatMap((row) => row.attachments.map((a) => a.key));
    const links = keys.length > 0 ? await this.links.linksFor(keys) : [];
    let next = 0;
    const byMessage = new Map<string, ConsignmentMessageView["attachments"]>();
    for (const row of rows) {
      byMessage.set(
        row.id,
        row.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName ?? fileNameFromKey(a.key),
          contentType: a.contentType,
          byteSize: a.byteSize,
          url: links[next++] ?? "",
        })),
      );
    }
    return byMessage;
  }
}

function authorName(row: Pick<ConsignmentMessageRow, "authorName" | "authorSide">): string {
  return row.authorName ?? (row.authorSide === "staff" ? "LAX specialist" : "A member");
}
