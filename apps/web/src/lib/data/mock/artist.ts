import type { ArtistProfile, ArtistReader } from "@/lib/data/contracts";

const PROFILES: ArtistProfile[] = [
  {
    id: "default",
    name: "Elena Vancortlandt",
    tagline: "The space between light and shadow is where memory resides.",
    bio: "Based in Brussels, Elena Vancortlandt explores the intersection of digital architectural precision and organic human emotion. Her works are characterized by a profound silence—a visual pause that invites the viewer to deconstruct their own relationship with built environments.",
    portraitUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBh2509E44haj_4MXXy2beAWfdNsL3gN4iZbv6zfHbpbsz8spYNK1hup4wdhp705FFPNyT1kNNHJDwnTHqrs8Eg8yEMdo0v2LYXbuVyLOK3_r8tzZzpC8sDVsoOlXzpJMdGyABvh4OlULz7VHayQW344Uds7yxpDbiZELiR2x_80qLxLB5xtSsGDdI_Pjq4eLnKWKSJOFTdxztZmO5pQis16hcbI2XeRi4ti7AMBd0sy6zd3o1xLDMo89umUCjAnMT5yhlK2D2CZW2F",
    stats: [
      { label: "Exhibitions", value: "24 Global" },
      { label: "Medium", value: "Mixed Media" },
      { label: "Works Sold", value: "142" },
      { label: "Since", value: "2001" },
    ],
  },
  {
    id: "alt",
    name: "Marcus Thorne",
    tagline: "Stone remembers what cities forget.",
    bio: "Marcus Thorne works in marble and light. His practice spans two decades of public installations and private commissions, with a focus on material honesty and temporal weight.",
    portraitUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB5K6jzXW896wPPBAmK5JWgnSAopkY53wiu-v1EJ_GjNXGxua5JNtDH8IBnhaWvoPWAXtrIZC3GQIbDJTHwT-8D1UsqfskABDkPwVMsIOXnVwsAPNFkybMP4rIgj10R7C0FIQKrjoLsxxymFOuErr4saRe-46-5mLb-OrmAJEvPz54I3qS9tJ7B4bPFVK8V28zZep-tH03aqSXAms6VCBT_wCu-rJewJzIAgwWDlkfv4b4j6qDslN8ROII3sjh5R4wCrjl3wX-yKHV2",
    stats: [
      { label: "Exhibitions", value: "18 Global" },
      { label: "Medium", value: "Marble" },
      { label: "Works Sold", value: "89" },
      { label: "Since", value: "2006" },
    ],
  },
];

function pickProfile(id: string): ArtistProfile {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const idx = n % PROFILES.length;
  const base = PROFILES[idx] ?? PROFILES[0];
  if (!base) {
    throw new Error("Artist profiles missing");
  }
  return { ...base, id };
}

export function createMockArtistReader(): ArtistReader {
  return {
    async getById(id: string): Promise<ArtistProfile | null> {
      if (!id) return null;
      return pickProfile(id);
    },
  };
}
