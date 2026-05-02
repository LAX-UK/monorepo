import { jwksKey } from "@auction/db";
import { and, eq, lt } from "drizzle-orm";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

const RETIREMENT_WINDOW_MS = 30 * 60 * 1000;

export async function retireExpiredJwksKeys(db: Db, now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - RETIREMENT_WINDOW_MS);
  await db
    .update(jwksKey)
    .set({ status: "retired" })
    .where(and(eq(jwksKey.status, "rotating"), lt(jwksKey.rotatedAt, cutoff)));
}
