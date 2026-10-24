import { randomUUID } from "node:crypto";
import type {
  AdminSavedViewRecord,
  CreateAdminSavedViewInput,
  CreateAdminSavedViewResult,
  IAdminSavedViewRepository,
  RenameAdminSavedViewResult,
  ReorderAdminSavedViewsResult,
} from "@auction/persistence/interfaces";

type Row = AdminSavedViewRecord & { ownerSubjectId: string };

/** Same contract as the Drizzle repository, for tests of the service and routes. */
export class InMemoryAdminSavedViewRepository implements IAdminSavedViewRepository {
  readonly rows: Row[] = [];

  private forList(owner: string, listKey: string): Row[] {
    return this.rows
      .filter((row) => row.ownerSubjectId === owner && row.listKey === listKey)
      .sort((a, b) => a.position - b.position);
  }

  private static strip({ ownerSubjectId: _owner, ...view }: Row): AdminSavedViewRecord {
    return view;
  }

  async list(owner: string, listKey: string): Promise<AdminSavedViewRecord[]> {
    return this.forList(owner, listKey).map(InMemoryAdminSavedViewRepository.strip);
  }

  async create(input: CreateAdminSavedViewInput): Promise<CreateAdminSavedViewResult> {
    const existing = this.forList(input.ownerSubjectId, input.listKey);
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
    this.rows.push(row);
    return { status: "created", view: InMemoryAdminSavedViewRepository.strip(row) };
  }

  async rename(owner: string, id: string, label: string): Promise<RenameAdminSavedViewResult> {
    const row = this.rows.find((r) => r.id === id && r.ownerSubjectId === owner);
    if (!row) return { status: "not_found" };
    const clash = this.rows.some(
      (r) =>
        r.ownerSubjectId === owner && r.listKey === row.listKey && r.label === label && r.id !== id,
    );
    if (clash) return { status: "duplicate_label" };
    row.label = label;
    return { status: "renamed", view: InMemoryAdminSavedViewRepository.strip(row) };
  }

  async reorder(
    owner: string,
    listKey: string,
    ids: readonly string[],
  ): Promise<ReorderAdminSavedViewsResult> {
    const current = this.forList(owner, listKey);
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
    return {
      status: "reordered",
      views: this.forList(owner, listKey).map(InMemoryAdminSavedViewRepository.strip),
    };
  }

  async remove(owner: string, id: string): Promise<boolean> {
    const index = this.rows.findIndex((r) => r.id === id && r.ownerSubjectId === owner);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    return true;
  }
}
