import { paletteRecordHint } from "@/components/layout/palette/palette-item-presenter";
import type { PaletteSource } from "@/components/layout/palette/types";
import { paletteJsonFetchPath } from "@/lib/data/http/palette-search.client";

const LIMIT = 5;

type InvitationRow = {
  id: string;
  email: string;
  status: string;
};

export const invitationsPaletteSource: PaletteSource = {
  id: "invitations",
  heading: "Invitations",
  enabled: true,
  async search(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const body = await paletteJsonFetchPath<{ data: InvitationRow[] }>("/admin/invitations");
    if (!body) return [];
    return body.data
      .filter(
        (inv) =>
          inv.email.toLowerCase().includes(q) ||
          inv.status.toLowerCase().includes(q) ||
          inv.id.toLowerCase().includes(q),
      )
      .slice(0, LIMIT)
      .map((inv) => ({
        id: `inv-${inv.id}`,
        href: "/admin/invitations",
        label: inv.email,
        hint: paletteRecordHint("record", inv.status) ?? "Invitation",
        kind: "record" as const,
      }));
  },
};
