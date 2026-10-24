import { randomUUID } from "node:crypto";
import type {
  SavedViewRecord,
  SavedViewRepository,
} from "../application/ports/saved-view.repository.js";

type Row = SavedViewRecord & { ownerSubjectId: string };

/** Same contract as the Drizzle repository, for tests of the service and routes. */
export function createInMemorySavedViewRepository(): SavedViewRepository & {
  readonly rows: Row[];
} {
  const rows: Row[] = [];
  const forList = (owner: string, listKey: string) =>
    rows
      .filter((row) => row.ownerSubjectId === owner && row.listKey === listKey)
      .sort((a, b) => a.position - b.position);
  const strip = ({ ownerSubjectId: _owner, ...view }: Row): SavedViewRecord => view;

  return {
    rows,
    async list(owner, listKey) {
      return forList(owner, listKey).map(strip);
    },
    async create(input) {
      const existing = forList(input.ownerSubjectId, input.listKey);
      if (existing.length >= input.maxPerList) return { status: "limit_reached" };
      if (existing.some((row) => row.label === input.label)) return { status: "duplicate_label" };
      const row: Row = {
        id: randomUUID(),
        ownerSubjectId: input.ownerSubjectId,
        listKey: input.listKey,
        label: input.label,
        query: input.query,
        position: existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.position)) + 1,
      };
      rows.push(row);
      return { status: "created", view: strip(row) };
    },
    async rename(owner, id, label) {
      const row = rows.find((r) => r.id === id && r.ownerSubjectId === owner);
      if (!row) return { status: "not_found" };
      const clash = rows.some(
        (r) =>
          r.ownerSubjectId === owner &&
          r.listKey === row.listKey &&
          r.label === label &&
          r.id !== id,
      );
      if (clash) return { status: "duplicate_label" };
      row.label = label;
      return { status: "renamed", view: strip(row) };
    },
    async reorder(owner, listKey, ids) {
      const current = forList(owner, listKey);
      const known = new Set(current.map((row) => row.id));
      if (
        new Set(ids).size !== ids.length ||
        ids.length !== known.size ||
        ids.some((id) => !known.has(id))
      ) {
        return { status: "mismatch" };
      }
      for (const [position, id] of ids.entries()) {
        const row = current.find((r) => r.id === id);
        if (row) row.position = position;
      }
      return { status: "reordered", views: forList(owner, listKey).map(strip) };
    },
    async remove(owner, id) {
      const index = rows.findIndex((r) => r.id === id && r.ownerSubjectId === owner);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
  };
}
