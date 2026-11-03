import {
  ACCOUNT_DATA_EXPORTS_CURRENT_PATH,
  ACCOUNT_DATA_EXPORTS_DELETE_PATH,
  ACCOUNT_DATA_EXPORTS_DOWNLOAD_PATH,
  ACCOUNT_DATA_EXPORTS_PATH,
  ACCOUNT_REAUTH_REQUIRED,
  subjectExportCreateOutcomeSchema,
  subjectExportCurrentSchema,
  subjectExportDeleteOutcomeSchema,
  subjectExportDownloadSchema,
} from "@auction/identity-contracts";
import type { z } from "zod";
import type { LaxAccountConfig } from "../config";
import type { IdentityActor } from "../ports/account-identity-gateway";
import type {
  DataExportCallResult,
  DataExportClient,
  DataExportGateway,
} from "../ports/data-export-gateway";

const REQUEST_TIMEOUT_MS = 5_000;
const GONE_STATUSES: ReadonlySet<number> = new Set([404, 410]);

/**
 * Calls Identity's data-download routes as LAX Account, for the person who owns the access
 * token. Tokens travel in the body, never a URL, and nothing here logs them. Every failure
 * (network, timeout, refusal, unexpected body) is `unavailable`, except the issuer's explicit
 * "sign in again" and "that copy is gone".
 */
export function createIssuerDataExportGateway(
  config: Pick<LaxAccountConfig, "oidcInternalIssuer" | "oidcClientId" | "oidcClientSecret">,
  fetchImpl: typeof fetch = fetch,
): DataExportGateway {
  const base = `${config.oidcInternalIssuer}/api/auth`;
  const basic = Buffer.from(
    `${encodeURIComponent(config.oidcClientId)}:${encodeURIComponent(config.oidcClientSecret)}`,
  ).toString("base64");

  async function post<S extends z.ZodTypeAny>(
    path: string,
    fields: Record<string, string>,
    schema: S,
  ): Promise<DataExportCallResult<z.infer<S>>> {
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams(fields),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        if (
          response.status === 403 &&
          (body as { error?: unknown } | null)?.error === ACCOUNT_REAUTH_REQUIRED
        ) {
          return { status: "reauth_required" };
        }
        if (GONE_STATUSES.has(response.status)) return { status: "gone" };
        console.warn("account_data_export_unavailable", { path, status: response.status });
        return { status: "unavailable" };
      }
      const parsed = schema.safeParse(await response.json());
      return parsed.success ? { status: "ok", value: parsed.data } : { status: "unavailable" };
    } catch (error) {
      console.warn("account_data_export_unavailable", {
        path,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return { status: "unavailable" };
    }
  }

  const signedIn = (actor: IdentityActor, extra: Record<string, string> = {}) => ({
    token: actor.accessToken,
    sid: actor.sid,
    ...extra,
  });

  /** Only what the person's browser sent; an absent value is left out so Identity records null. */
  const clientFields = (client: DataExportClient): Record<string, string> => ({
    ...(client.ip ? { ip: client.ip } : {}),
    ...(client.userAgent ? { user_agent: client.userAgent } : {}),
  });

  return {
    async readCurrent(actor) {
      const result = await post(
        ACCOUNT_DATA_EXPORTS_CURRENT_PATH,
        { token: actor.accessToken },
        subjectExportCurrentSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.export } : result;
    },
    request(actor, client) {
      return post(
        ACCOUNT_DATA_EXPORTS_PATH,
        signedIn(actor, clientFields(client)),
        subjectExportCreateOutcomeSchema,
      );
    },
    async download(actor, exportId, client) {
      const result = await post(
        ACCOUNT_DATA_EXPORTS_DOWNLOAD_PATH,
        signedIn(actor, { id: exportId, ...clientFields(client) }),
        subjectExportDownloadSchema,
      );
      return result.status === "ok" ? { status: "ok", value: { url: result.value.url } } : result;
    },
    async deleteCopy(actor, exportId) {
      const result = await post(
        ACCOUNT_DATA_EXPORTS_DELETE_PATH,
        signedIn(actor, { id: exportId }),
        subjectExportDeleteOutcomeSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.outcome } : result;
    },
  };
}
