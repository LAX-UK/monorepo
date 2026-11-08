import type { PrintParty, PrintPartyStore } from "../application/ports/print-party.store.js";

/** A printers and publishers list held in memory, with the same name rules as the table. */
export function createInMemoryPrintPartyStore(initial: readonly string[] = []): PrintPartyStore {
  const rows = new Map<string, PrintParty>();
  let next = 0;
  const idFor = () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
  const insert = (name: string) => {
    const row = { id: idFor(), name };
    rows.set(row.id, row);
    return row;
  };
  for (const name of initial) insert(name);
  return {
    async list() {
      return [...rows.values()].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
    },
    async add(name) {
      if ([...rows.values()].some((row) => row.name.toLowerCase() === name.toLowerCase())) {
        return "exists";
      }
      return insert(name);
    },
    async remove(id) {
      return rows.delete(id);
    },
  };
}
