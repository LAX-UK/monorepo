import { describe, expect, it, vi } from "vitest";
import type { MemberChangeResult } from "./member-management.actions";
import { type RoleChangePorts, changeMemberRole } from "./role-change-flow";

const LENA = { id: "lena", name: "Lena Fischer" };
const ORG = "Northbank Gallery";

function ports(results: MemberChangeResult[]) {
  const log: string[] = [];
  let undo: (() => void) | undefined;
  const p: RoleChangePorts = {
    update: vi.fn(async (_id: string, role: string): Promise<MemberChangeResult> => {
      log.push(`update:${role}`);
      return results.shift() ?? { ok: true };
    }),
    show: (_id, role) => log.push(`show:${role ?? "saved"}`),
    busy: (_id, busy) => log.push(busy ? "busy" : "idle"),
    rowError: (_id, message) => log.push(message ? `error:${message}` : "clear"),
    toast: (copy, onUndo) => {
      log.push(`toast:${copy.title}${copy.description ? ` | ${copy.description}` : ""}`);
      undo = onUndo;
    },
  };
  return { p, log, undo: () => undo?.() };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("changeMemberRole", () => {
  it("shows success only after the server agrees, with Undo", async () => {
    const { p, log } = ports([{ ok: true }]);
    await changeMemberRole(p, LENA, "finance", "admin", ORG);
    expect(log).toEqual([
      "clear",
      "show:admin",
      "busy",
      "update:admin",
      "idle",
      "toast:Lena Fischer is now an admin.",
    ]);
  });

  it("puts the saved role back and says why on the row when refused", async () => {
    const { p, log } = ports([{ ok: false, code: "owner_only", error: "Only an owner can." }]);
    await changeMemberRole(p, LENA, "finance", "owner", ORG);
    expect(log.slice(-2)).toEqual(["show:saved", "error:Only an owner can."]);
    expect(log.some((line) => line.startsWith("toast:"))).toBe(false);
  });

  it("reverts through the same change on Undo", async () => {
    const { p, log, undo } = ports([{ ok: true }, { ok: true }]);
    await changeMemberRole(p, LENA, "finance", "admin", ORG);
    undo();
    await flush();
    expect(p.update).toHaveBeenLastCalledWith("lena", "finance");
    expect(log.at(-1)).toBe("toast:Lena Fischer is a finance member again.");
  });

  it("keeps the new role and explains on the row when Undo is refused", async () => {
    const { p, log, undo } = ports([
      { ok: true },
      { ok: false, code: null, error: "That didn't go through. Try again in a moment." },
    ]);
    await changeMemberRole(p, LENA, "finance", "admin", ORG);
    undo();
    await flush();
    expect(log.slice(-2)).toEqual([
      "show:admin",
      "error:We couldn't make Lena Fischer a finance member again. That didn't go through. Try again in a moment.",
    ]);
  });

  it("warns that Undo will not bring back a buyer agent's authorisations", async () => {
    const { p, log } = ports([{ ok: true }]);
    await changeMemberRole(p, LENA, "buyer_agent", "viewer", ORG);
    expect(log.at(-1)).toBe(
      "toast:Lena Fischer is now a viewer. | Their authorisations to bid for Northbank Gallery have ended, and Undo won't bring them back.",
    );
  });

  it("does nothing when the role is unchanged", async () => {
    const { p, log } = ports([]);
    await changeMemberRole(p, LENA, "finance", "finance", ORG);
    expect(log).toEqual([]);
  });
});
