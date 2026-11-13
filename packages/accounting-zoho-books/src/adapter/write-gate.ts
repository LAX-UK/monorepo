import { ZohoBooksConfigError } from "../config.js";
import { ZohoValidationError, zohoFail } from "../errors.js";
import type { ZohoApi } from "./api.js";
import type { ZohoOrgConfigs } from "./org-config.js";

/**
 * Whether the adapter may write. `dry_run` (the default) sends no create or update at all, to any
 * organisation. `test_org` and `live` both write, but only to the organisations named, and the
 * caller has to say which one it means: there is no way to get a writing adapter by leaving
 * something out.
 */
export type ZohoWriteMode =
  | { readonly mode: "dry_run" }
  | {
      readonly mode: "test_org" | "live";
      /** Books organisation ids writes may go to; each must be one of the configured ones. */
      readonly organizationIds: readonly string[];
    };

export const DRY_RUN: ZohoWriteMode = { mode: "dry_run" };

/**
 * The adapter's own write guard. Gateways ask `permits` before doing anything for a document, so a
 * refused write sends no request at all (not even the dependency lookups). The API it hands out
 * also refuses POST and PUT on its own, so a code path that forgot to ask still cannot write.
 */
export class WriteGate {
  private readonly allowed: ReadonlySet<string>;

  constructor(
    readonly mode: ZohoWriteMode,
    orgs: ZohoOrgConfigs,
  ) {
    if (mode.mode === "dry_run") {
      this.allowed = new Set();
      return;
    }
    if (mode.mode !== "test_org" && mode.mode !== "live") {
      throw new ZohoBooksConfigError("write_mode_invalid");
    }
    const configured = new Set(Object.values(orgs).map((o) => o?.organizationId));
    if (mode.organizationIds.length === 0) throw new ZohoBooksConfigError("write_allow_list_empty");
    for (const id of mode.organizationIds) {
      if (!configured.has(id)) throw new ZohoBooksConfigError("write_allow_list_unknown_org");
    }
    this.allowed = new Set(mode.organizationIds);
  }

  permits(organizationId: string): boolean {
    return this.allowed.has(organizationId);
  }

  /** `api` with every write to an organisation not allowed refused before it is sent. */
  guard(api: ZohoApi): ZohoApi {
    const refused = () =>
      Promise.resolve(zohoFail(new ZohoValidationError({ code: "writes_disabled" })));
    return {
      get: (organizationId, path, query) => api.get(organizationId, path, query),
      post: (organizationId, path, body, query) =>
        this.permits(organizationId) ? api.post(organizationId, path, body, query) : refused(),
      put: (organizationId, path, body, query) =>
        this.permits(organizationId) ? api.put(organizationId, path, body, query) : refused(),
    };
  }
}
