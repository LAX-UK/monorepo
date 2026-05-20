import { paletteApiBase } from "@/components/layout/palette/api-base";
import type { PaletteSource } from "@/components/layout/palette/types";

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
    const res = await fetch(`${paletteApiBase()}/admin/invitations`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: InvitationRow[] };
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
        hint: inv.status,
      }));
  },
};
