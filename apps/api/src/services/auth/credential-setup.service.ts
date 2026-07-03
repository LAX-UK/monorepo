import { account } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { Container } from "../../container.js";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";

export async function setupCredentialPassword(args: {
  container: Container;
  userId: string;
  password: string;
  authAudit?: IAuthAuditPublisher | undefined;
}): Promise<{ ok: true } | { ok: false; kind: "user_not_found" | "already_set" | "db_error" }> {
  const { container, userId, password, authAudit } = args;

  const current = await container.userService.getById(userId);
  if (!current) return { ok: false, kind: "user_not_found" };

  const auth = container.auth as unknown as {
    $context: Promise<{ password: { hash: (pw: string) => Promise<string> } }>;
  };
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  let alreadySet = false;
  try {
    await container.authDb.transaction(async (tx) => {
      const existing = await tx
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
        .limit(1);
      if (existing.length > 0) {
        alreadySet = true;
        return;
      }
      const now = new Date();
      await tx.insert(account).values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hash,
        createdAt: now,
        updatedAt: now,
      });
    });
  } catch {
    return { ok: false, kind: "db_error" };
  }

  if (alreadySet) return { ok: false, kind: "already_set" };

  void authAudit
    ?.publish({
      eventType: "auth.password_credential_enabled",
      aggregateId: userId,
      payload: {},
      actorUserId: userId,
    })
    .catch(() => {});

  void container.emailService.enqueue({
    template: "password-changed",
    to: current.email,
    userId,
    category: "auth",
    vars: { userName: current.name },
  });

  return { ok: true };
}
