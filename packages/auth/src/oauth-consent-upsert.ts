// biome-ignore lint/suspicious/noExplicitAny: Better Auth adapter methods use heterogeneous per-model args
type AdapterMethod = (...args: any[]) => Promise<any>;

type AuthDbAdapter = {
  create: AdapterMethod;
  findOne: AdapterMethod;
  update: AdapterMethod;
  transaction: (cb: (tx: AuthDbAdapter) => Promise<unknown>) => Promise<unknown>;
  [key: string]: unknown;
};

const wrappedSym = Symbol("auction.auth.oauthConsentUpsertWrapped");

function isAlreadyWrapped(adapter: AuthDbAdapter): boolean {
  return Object.getOwnPropertyDescriptor(adapter, wrappedSym)?.value === true;
}

function mergeConsentScopes(existing: unknown, incoming: unknown): string {
  const parts = [
    ...(typeof existing === "string" ? existing.split(" ") : []),
    ...(typeof incoming === "string" ? incoming.split(" ") : []),
  ].filter(Boolean);
  return [...new Set(parts)].join(" ");
}

/** Better Auth always inserts oauthConsent; upsert when the client/user pair already exists. */
export function wrapOAuthConsentUpsertAdapter(base: AuthDbAdapter): AuthDbAdapter {
  if (isAlreadyWrapped(base)) {
    return base;
  }

  const wrap = (adapter: AuthDbAdapter): AuthDbAdapter => {
    if (isAlreadyWrapped(adapter)) {
      return adapter;
    }

    const out: AuthDbAdapter = {
      ...adapter,
      async create(
        args: { model: string; data: Record<string, unknown> } & Record<string, unknown>,
      ) {
        if (args.model !== "oauthConsent") {
          return adapter.create(args);
        }

        const clientId = args.data.clientId;
        const userId = args.data.userId;
        if (typeof clientId !== "string" || typeof userId !== "string") {
          return adapter.create(args);
        }

        const existing = (await adapter.findOne({
          model: "oauthConsent",
          where: [
            { field: "clientId", value: clientId },
            { field: "userId", value: userId },
          ],
        })) as Record<string, unknown> | null;

        if (!existing) {
          return adapter.create(args);
        }

        return adapter.update({
          model: "oauthConsent",
          where: [
            { field: "clientId", value: clientId },
            { field: "userId", value: userId },
          ],
          update: {
            ...args.data,
            scopes: mergeConsentScopes(existing.scopes, args.data.scopes),
            updatedAt: new Date(),
          },
        });
      },
      async transaction(cb: (tx: AuthDbAdapter) => Promise<unknown>) {
        return adapter.transaction(async (tx) => cb(wrap(tx as AuthDbAdapter)));
      },
    };

    Object.defineProperty(out, wrappedSym, { value: true, enumerable: false });
    return out;
  };

  return wrap(base);
}
