import type { ArtistProfile, ArtistReader } from "@/lib/data/contracts";

const PROFILES: ArtistProfile[] = [
  {
    id: "elena-vostrova",
    name: "Elena Vostrova",
    tagline:
      "Exploring the intersection of brutalist architecture and organic fluid forms. Her latest collection redefines the contemporary sculptural landscape.",
    bio: "Based in Brussels, Elena Vostrova explores the intersection of digital architectural precision and organic human emotion. Her works invite the viewer to deconstruct their own relationship with built environments.",
    portraitUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAQY8il1n1XXFi67IfE21kcuCoFilCCOUOtaUj45qJfGvWSLlg7vFvYc0ZT2ec5uYynOQdmI3hwdjSU_ragRU_8O8PiyOc4hZBlaBm38ugmBCglO8grqVd8nZ9QWNG4_g6b08EkhZIInhrt697Ej1ksnNfm1UOQ7EBnINWAQRYJaoSGUuml28k7cVcf26SvP_PBEQCdMi8_UgFKil2dCT8gN33DT0Y1h5PRwpq7NsIk4ypvtr5Oac8YKPH0yY0o-DPNWB7thI_ZJl_v",
    discipline: "Mixed media / architecture",
    stats: [
      { label: "Exhibitions", value: "24 Global" },
      { label: "Medium", value: "Mixed Media" },
      { label: "Works Sold", value: "142" },
      { label: "Since", value: "2001" },
    ],
  },
  {
    id: "julian-castelli",
    name: "Julian Castelli",
    tagline:
      "Known for his monumental bronze works that challenge the perception of weight and balance in urban spaces.",
    bio: "Julian Castelli works at the scale of the city. His bronze installations question permanence, gravity, and the dialogue between monument and pedestrian life.",
    portraitUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDdWRCvBwpSn3kSELskfqrTqPtrATw_y3A53de81dR4N3C5UEWx1TFO8Al37oZ3v5VPLWA7V3DDqdyMSB8ej9l490EtNLQsHMHZY4V8kBlVP1oqaAi7EMEPVKM_rrDc7ocovJRfaSGQBke7l-_3wMKVNNVu6Cdu549y8gHagO4ci1I2_-nzEZe2fGZqFXTsNsQa8ngVweouzwfKYjHOLir8efWhgdRc82sGDRMNj0PcCRLR7KWHqcTmnfQf51WOVxkKgLV3V2RPNNra",
    discipline: "Sculpture / bronze",
    stats: [
      { label: "Exhibitions", value: "12 Global" },
      { label: "Medium", value: "Bronze" },
      { label: "Works Sold", value: "56" },
      { label: "Since", value: "2008" },
    ],
  },
  {
    id: "amara-okoro",
    name: "Amara Okoro",
    tagline:
      "Pioneering the use of generative neural networks to visualize ancestral memories in the digital diaspora.",
    bio: "Amara Okoro merges code and cultural memory. Her practice spans installation, print, and time-based media.",
    portraitUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDc9XdcHkCeudqVJ3YySjx2oCb9rab5gG56MxwaIIT9NMCwVgNcAvbCfBr69BWskfCMS_l5j-wJNDBi-0tkcybf7CZIbCOz6f_X1tkCZeHFBEs1BEAh2Z60YlwYqIeGaLHqJzH_RvyW2dfjJXDJVk0S4YFlwSj9wMfz7qxSlAlbNDTNVYCHnIQ7W3dY7PldHwJooiLwFtiEXSbrpC4WzKFdPU6TzPb4C9zqDrJR25onoXy1PHJFK4xS9W1UhYhJb3VCXrQ8vmZeScJ5",
    discipline: "Digital art / Gen-AI",
    stats: [
      { label: "Exhibitions", value: "9 Global" },
      { label: "Medium", value: "Digital" },
      { label: "Works Sold", value: "203" },
      { label: "Since", value: "2015" },
    ],
  },
  {
    id: "cato-van-dyck",
    name: "Cato Van Dyck",
    tagline:
      "Master of white-on-white textural paintings that evoke the silence of Nordic winter landscapes.",
    bio: "Cato Van Dyck’s minimal surfaces reward slow looking. Each canvas is built from countless translucent layers.",
    portraitUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCzhUOytTb8Q9E30QD4Q837-50DZWtTWF76_fzvIC1uLZVIwJOb-K5tkLUbIxwpZr2awQ70Mid3ME3P-3Zj_O6ZD4TbySaMKpyP2ya4m2fBC6ghRqRkk8mAamptuPkzvqrE3byDYXStN-PxSKXrY7o428iqmtBXzabWzEk9-KCU9VR6wT-XGMTUY16zrs-R838OO62pbpJz4QEpYnI-y2zQlpjkRxEUA6Nc3lqNeQOkU8Dg98wnni98FZOxqmk0aSG6gxa3Cv_JJcDa",
    discipline: "Oil on canvas / minimalism",
    stats: [
      { label: "Exhibitions", value: "31 Global" },
      { label: "Medium", value: "Oil" },
      { label: "Works Sold", value: "78" },
      { label: "Since", value: "1999" },
    ],
  },
  {
    id: "saffron-reeves",
    name: "Saffron Reeves",
    tagline:
      "Capturing the haunting beauty of abandoned industrial sites through large-format film photography.",
    bio: "Saffron Reeves travels with a field camera and patience. Her analog prints insist on material presence in a digital age.",
    portraitUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCRGbh2PVR9ukTV-yWIUV_SrcLcV9tc8bfNpjNHsuUzI8F6YN-a_ABlKb5PaHJ9zoFoQcRzZ0WRoMr6KtSX48hfi0MKX_NIZptDqtJBlVwN8FRRv2RWMT2S3LaXw8vyRxBJdDiiqEBTwMabRYUHA9BFO_-XjFuPgsMjHTeBGwQw-9xHG5WyDHKd7JM58lQx6E2TTmSTBiVS-yxVIi4-3MmikJAKPp9u1BGXh5qNCbBqOqNMLNxY4jwMhawY4-_R-MIvGhJGnJlGcI3Y",
    discipline: "Photography / analog",
    stats: [
      { label: "Exhibitions", value: "16 Global" },
      { label: "Medium", value: "Photography" },
      { label: "Works Sold", value: "91" },
      { label: "Since", value: "2004" },
    ],
  },
  {
    id: "hiroshi-kuma",
    name: "Hiroshi Kuma",
    tagline:
      "Deconstructing traditional sashiko techniques to create expansive, three-dimensional fabric installations.",
    bio: "Hiroshi Kuma learned stitchcraft in his grandmother’s workshop. Today his installations fill museums and biennials.",
    portraitUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDrM-ueqX8npr0SLpBqeZmYk0rnUm5_AWS36ziyh7TAIAKwZgqTANpFjbtizhqinCHMuhQLmOgqHtVUXUKzPuV5QrXDJTTRmzliejBlNci0ZXU_AwK1RCQ_W_bT-LjvVT-JJ9yAiLaYOt48OQwfppKxNhhY3sJHIdomXPUzNFmbZz5Y44WJVRtnXzWlGldkIJwYy_KhVKl6tzIUSovPLKtIkM5cJJcha9aI7CN4z3TqShQ1EPRI44nt9W7z3U0cH9AaR-wNneuRoemh",
    discipline: "Mixed media / textile",
    stats: [
      { label: "Exhibitions", value: "21 Global" },
      { label: "Medium", value: "Textile" },
      { label: "Works Sold", value: "44" },
      { label: "Since", value: "2010" },
    ],
  },
  {
    id: "beatrix-lombe",
    name: "Beatrix Lombe",
    tagline:
      "Creating wearable sculptures that explore the biological geometry of the human anatomy.",
    bio: "Beatrix Lombe trained as a goldsmith and anatomical illustrator. Her jewelry reads as miniature sculpture.",
    portraitUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC9RDvpwDp8-oJvAj3V736qUGf-g4h1GqXPJl3wqJJp5-UYqMd0spWhrahBW7Zi4kg6siyfLUs9lm_STAR_SZJp-B4qllI-s8tRX24o5PmVaaWzR_zLaqb6HaXPVNPY7XOYjyFtVFO_GNGRiqD_bULwB0Y60nGjl5u-rvgJaJ0e0dG-cJmjyYNo5Y9kmSf7qJ_8g6IPYh-GlOqSkawOEuQ49WI1ofFL0viiMSFrPzsZX5mhrndWL7E-qUh2h5zxZPcoVgpMnlJNQWQv",
    discipline: "Jewelry / avant-garde",
    stats: [
      { label: "Exhibitions", value: "14 Global" },
      { label: "Medium", value: "Jewelry" },
      { label: "Works Sold", value: "67" },
      { label: "Since", value: "2007" },
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
    async listFeatured(): Promise<ArtistProfile[]> {
      return PROFILES.map((p) => ({ ...p }));
    },
  };
}
