import { SITE_NAME } from "@/lib/brand";
import { getServerArtistReader } from "@/lib/data/http/artist.server";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Artist profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Image({ params }: Props) {
  const { id } = await params;
  const reader = await getServerArtistReader();
  let name = "Artist";
  let tagline = "";
  let portrait: string | null = null;
  try {
    const artist = await reader.getById(id);
    if (artist) {
      name = artist.name;
      tagline = artist.tagline ?? "";
      portrait = artist.portraitUrl ?? null;
    }
  } catch {
    /* fall through */
  }
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: "#0d0d0f",
        color: "#f3efe6",
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          width: "45%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1c",
        }}
      >
        {portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portrait}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ display: "flex", fontSize: 96, color: "#3b3b3f" }}>
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div
        style={{
          width: "55%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 56px",
        }}
      >
        <div
          style={{ display: "flex", fontSize: 22, letterSpacing: 6, textTransform: "uppercase" }}
        >
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 600 }}>{name}</div>
          {tagline ? (
            <div
              style={{
                display: "flex",
                fontSize: 26,
                color: "#c9c0ad",
                fontStyle: "italic",
                maxWidth: 540,
              }}
            >
              {tagline}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
