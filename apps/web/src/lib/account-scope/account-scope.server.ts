import "server-only";

import { getServerSessionUser } from "@/lib/data/http/session.reader";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { deriveActingContext } from "@/lib/legal-entity/derive-acting-context";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import type { LegalEntitySummary } from "@auction/types";
import { cache } from "react";
import type { AccountScope, IAccountScope, ScopedAccount } from "./account-scope";

/** The account a resolved acting membership stands for. */
export function scopedAccountFor(acting: LegalEntitySummary | null): ScopedAccount {
  if (acting?.kind !== "organisation") return { kind: "personal" };
  return {
    kind: "organisation",
    id: acting.id,
    name: acting.displayName,
    actor: { role: acting.role, isImpersonation: acting.isImpersonation },
  };
}

/** Once per request, so the layout, the page and the menu counts read the same account. */
const resolveAccountScope = cache(async (): Promise<AccountScope> => {
  const user = await getServerSessionUser();
  if (!user) throw new Error("account_scope_requires_session");
  const [actingContext, orgModuleEnabled] = await Promise.all([
    resolveActingContext(user.role, user.staffRoles),
    resolveOrgModuleEnabledFromRequest(),
  ]);
  const { safeActing } = deriveActingContext({ actingContext, orgModuleEnabled });
  return { account: scopedAccountFor(safeActing), actor: { userId: user.id } };
});

/** Server adapter for {@link IAccountScope}: the acting-account cookie, checked by the API. */
export const serverAccountScope: IAccountScope = { current: resolveAccountScope };
