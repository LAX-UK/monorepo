import { SITE_NAME } from "@/lib/brand";
import { OG_BRAND } from "@/lib/brand/og-colors";
import { fetchRegistryArtistById, getServerArtistById } from "@/lib/data/http/artist.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { renderOgJpeg } from "@/lib/seo/og-image-response";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

type Props = {
  params: Promise<{ slug: string; id: string }>;
};

export async function generateImageMetadata({ params }: Props) {
  const { id } = await params;
  let alt = "Artist profile";
  try {
    const [artist, registry] = await Promise.all([
      getServerArtistById(id).catch(() => null),
      fetchRegistryArtistById(id).catch(() => null),
    ]);
    if (registry?.displayName) alt = registry.displayName;
    else if (artist?.name) alt = artist.name;
    else {
      const user = await getServerPublicUserReader()
        .then((reader) => reader.getById(id))
        .catch(() => null);
      if (user?.name) alt = user.name;
    }
  } catch {
    /* fall through */
  }
  return [{ id: "default", alt, size, contentType }];
}

const KIND_LABEL: Record<string, string> = {
  artist: "Artist",
  maker: "Maker",
  brand: "Brand",
  marque: "Marque",
};

function formatLifespan(
  birth: number | null | undefined,
  death: number | null | undefined,
): string {
  if (typeof birth === "number" && typeof death === "number") return `${birth} – ${death}`;
  if (typeof birth === "number") return `b. ${birth}`;
  if (typeof death === "number") return `d. ${death}`;
  return "";
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  let name = "Artist";
  let tagline = "";
  let subtitle = "";
  let portrait: string | null = null;
  const chips: string[] = [];
  try {
    const [artist, registry] = await Promise.all([
      getServerArtistById(id).catch(() => null),
      fetchRegistryArtistById(id).catch(() => null),
    ]);
    if (registry) {
      name = registry.displayName;
      portrait = registry.portraitUrl ?? null;
      const lifespan = formatLifespan(
        Number.parseInt(registry.birthYear ?? "", 10) || null,
        Number.parseInt(registry.deathYear ?? "", 10) || null,
      );
      subtitle = [lifespan, registry.nationality?.trim() ?? ""].filter(Boolean).join(" · ");
      tagline = registry.shortBio?.trim() ?? "";
      if (registry.featured) chips.push("Featured");
      if (registry.verified) chips.push("Verified");
      const kindLabel = KIND_LABEL[registry.kind ?? ""] ?? "";
      if (kindLabel) chips.push(kindLabel);
    } else if (artist) {
      name = artist.name;
      tagline = artist.tagline ?? "";
      portrait = artist.portraitUrl ?? null;
    } else {
      const user = await getServerPublicUserReader()
        .then((reader) => reader.getById(id))
        .catch(() => null);
      if (user) {
        name = user.name;
        tagline = "Seller on LAX.BID by London Art Exchange.";
        portrait = user.image ?? null;
      }
    }
  } catch {
    /* fall through */
  }
  return renderOgJpeg(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: OG_BRAND.background,
        color: OG_BRAND.foreground,
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
          backgroundColor: OG_BRAND.panel,
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
          <div style={{ display: "flex", fontSize: 220, color: OG_BRAND.muted, lineHeight: 1 }}>
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
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {chips.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {chips.map((c) => (
                <div
                  key={c}
                  style={{
                    display: "flex",
                    fontSize: 18,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    padding: "6px 14px",
                    border: `1px solid ${OG_BRAND.muted}`,
                    color: OG_BRAND.muted,
                    borderRadius: 999,
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 600 }}>{name}</div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: OG_BRAND.muted,
                letterSpacing: 1,
              }}
            >
              {subtitle}
            </div>
          ) : null}
          {tagline ? (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: OG_BRAND.muted,
                fontStyle: "italic",
                maxWidth: 600,
                lineHeight: 1.3,
              }}
            >
              {tagline.length > 140 ? `${tagline.slice(0, 137).trimEnd()}…` : tagline}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
  );
}
