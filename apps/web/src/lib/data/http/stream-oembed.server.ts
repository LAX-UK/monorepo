import "server-only";

type OEmbedResponse = {
  html?: string;
  title?: string;
  thumbnail_url?: string;
};

export type StreamOEmbedResult =
  | { status: "not_found" }
  | { status: "unverified" }
  | { status: "verified"; title?: string; thumbnailUrl?: string };

export async function fetchStreamOEmbed(
  oembedUrl: string,
  timeoutMs: number,
): Promise<StreamOEmbedResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 404 || res.status === 403) {
      return { status: "not_found" };
    }

    if (!res.ok) {
      return { status: "unverified" };
    }

    const data = (await res.json()) as OEmbedResponse;
    if (!data.html) {
      return { status: "not_found" };
    }

    return {
      status: "verified",
      ...(data.title ? { title: data.title } : {}),
      ...(data.thumbnail_url ? { thumbnailUrl: data.thumbnail_url } : {}),
    };
  } catch {
    clearTimeout(timeout);
    return { status: "unverified" };
  }
}
