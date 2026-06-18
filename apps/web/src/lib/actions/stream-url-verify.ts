"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { type ActionResult, actionSuccess } from "@/lib/forms/form-result";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import {
  type StreamEmbedProvider,
  buildStreamOEmbedEndpoint,
  parseStreamEmbedUrl,
} from "@auction/validators";

const OEMBED_TIMEOUT_MS = 5000;

export type StreamUrlVerifyPayload =
  | {
      status: "empty";
    }
  | {
      status: "unsupported";
    }
  | {
      status: "not_found";
    }
  | {
      status: "verified";
      provider: StreamEmbedProvider;
      title?: string;
      thumbnailUrl?: string;
    }
  | {
      status: "unverified";
      provider: StreamEmbedProvider;
    }
  | {
      status: "live_check_unavailable";
      provider: StreamEmbedProvider;
    };

type OEmbedResponse = {
  html?: string;
  title?: string;
  thumbnail_url?: string;
};

/** Admin-only: validate that a sale stream URL is embeddable via provider oEmbed. */
export async function verifyStreamUrlAction(
  url: string,
): Promise<ActionResult<StreamUrlVerifyPayload>> {
  return instrumentServerAction("verifyStreamUrlAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;

    const trimmed = url.trim();
    if (!trimmed) {
      return actionSuccess({ status: "empty" });
    }

    const parsed = parseStreamEmbedUrl(trimmed);
    if (!parsed) {
      return actionSuccess({ status: "unsupported" });
    }

    const oembedUrl = buildStreamOEmbedEndpoint(parsed, trimmed);
    if (!oembedUrl) {
      return actionSuccess({
        status: "live_check_unavailable",
        provider: parsed.provider,
      });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS);
      const res = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.status === 404 || res.status === 403) {
        return actionSuccess({ status: "not_found" });
      }

      if (!res.ok) {
        return actionSuccess({
          status: "unverified",
          provider: parsed.provider,
        });
      }

      const data = (await res.json()) as OEmbedResponse;
      if (!data.html) {
        return actionSuccess({ status: "not_found" });
      }

      return actionSuccess({
        status: "verified",
        provider: parsed.provider,
        ...(data.title ? { title: data.title } : {}),
        ...(data.thumbnail_url ? { thumbnailUrl: data.thumbnail_url } : {}),
      });
    } catch {
      return actionSuccess({
        status: "unverified",
        provider: parsed.provider,
      });
    }
  });
}
