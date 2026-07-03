import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { count } from "drizzle-orm";
import type {
  AdminUserListFilter,
  AdminUserListResult,
  IAdminUserReader,
} from "../ports/admin-user.js";
import {
  adminUserListSelect,
  buildAdminUserListOrderBy,
  buildAdminUserListWhere,
  mapAdminUserListRow,
} from "./admin-user-list-sql.js";

export class DrizzleExportAdminUserReader implements Pick<IAdminUserReader, "list"> {
  constructor(private readonly db: Database) {}

  async list(filter: AdminUserListFilter): Promise<AdminUserListResult> {
    const whereClause = buildAdminUserListWhere(filter);

    const countQuery = this.db.select({ n: count() }).from(user);
    const [countRow] = whereClause ? await countQuery.where(whereClause) : await countQuery;

    const orderBy = buildAdminUserListOrderBy(filter.sort);
    const base = this.db
      .select(adminUserListSelect)
      .from(user)
      .orderBy(orderBy)
      .limit(filter.limit)
      .offset(filter.offset);
    const rows = whereClause ? await base.where(whereClause) : await base;

    return {
      rows: rows.map(mapAdminUserListRow),
      total: Number(countRow?.n ?? 0),
    };
  }
}
