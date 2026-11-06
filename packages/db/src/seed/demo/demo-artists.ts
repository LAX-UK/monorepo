/**
 * The registry artists the demo lots are attributed to, as plain data with fixed ids. Real
 * historical makers are the real people or firms the catalogue note names; the painters of the
 * top-up's contemporary lots are invented for the demo. Lots with no known maker are listed in
 * `UNATTRIBUTED_WORKS`, each with the reason.
 */
import type { WorkKey } from "./demo-full-works.js";

const artistId = (n: number) => `dea10000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

export type DemoArtist = {
  id: string;
  slug: string;
  displayName: string;
  kind: "artist" | "maker" | "studio" | "manufacturer" | "printer";
  nationality: string;
  countryCode: string;
  /** Person-kind lifespan. */
  birthYear?: string;
  deathYear?: string;
  /** Organisation-kind start year. */
  foundedYear?: string;
};

const person = (
  n: number,
  displayName: string,
  slug: string,
  nationality: string,
  countryCode: string,
  birthYear: string,
  deathYear?: string,
  kind: DemoArtist["kind"] = "artist",
): DemoArtist => ({
  id: artistId(n),
  slug,
  displayName,
  kind,
  nationality,
  countryCode,
  birthYear,
  ...(deathYear ? { deathYear } : {}),
});

const house = (
  n: number,
  displayName: string,
  slug: string,
  kind: DemoArtist["kind"],
  nationality: string,
  countryCode: string,
): DemoArtist => ({ id: artistId(n), slug, displayName, kind, nationality, countryCode });

export const DEMO_ARTISTS = {
  // ── Historical artists and makers behind the full catalogue ──
  degas: person(1, "Edgar Degas", "edgar-degas", "French", "FR", "1834", "1917"),
  turner: person(2, "J. M. W. Turner", "jmw-turner", "British", "GB", "1775", "1851"),
  manet: person(3, "Edouard Manet", "edouard-manet", "French", "FR", "1832", "1883"),
  vanGogh: person(4, "Vincent van Gogh", "vincent-van-gogh", "Dutch", "NL", "1853", "1890"),
  rodin: person(5, "Auguste Rodin", "auguste-rodin", "French", "FR", "1840", "1917"),
  giambologna: person(6, "Giambologna", "giambologna", "Flemish-Italian", "IT", "1529", "1608"),
  leGray: person(7, "Gustave Le Gray", "gustave-le-gray", "French", "FR", "1820", "1884"),
  muybridge: person(8, "Eadweard Muybridge", "eadweard-muybridge", "British", "GB", "1830", "1904"),
  cameron: person(
    9,
    "Julia Margaret Cameron",
    "julia-margaret-cameron",
    "British",
    "GB",
    "1815",
    "1879",
  ),
  hunt: person(10, "William Holman Hunt", "william-holman-hunt", "British", "GB", "1827", "1910"),
  rembrandt: person(11, "Rembrandt van Rijn", "rembrandt-van-rijn", "Dutch", "NL", "1606", "1669"),
  hokusai: person(12, "Katsushika Hokusai", "katsushika-hokusai", "Japanese", "JP", "1760", "1849"),
  hiroshige: person(13, "Utagawa Hiroshige", "utagawa-hiroshige", "Japanese", "JP", "1797", "1858"),
  durer: person(14, "Albrecht Dürer", "albrecht-durer", "German", "DE", "1471", "1528"),
  carloBugatti: person(
    15,
    "Carlo Bugatti",
    "carlo-bugatti",
    "Italian",
    "IT",
    "1856",
    "1940",
    "maker",
  ),
  breguet: house(16, "Breguet", "breguet", "manufacturer", "French", "FR"),
  roskell: house(17, "Robert Roskell", "robert-roskell", "maker", "British", "GB"),
  perigal: house(18, "Francis Perigal", "francis-perigal", "maker", "British", "GB"),
  leRoy: house(19, "Julien Le Roy", "julien-le-roy", "maker", "French", "FR"),
  brockbank: house(
    20,
    "John and Myles Brockbank",
    "john-and-myles-brockbank",
    "maker",
    "British",
    "GB",
  ),
  boysen: house(21, "Boysen Toys", "boysen-toys", "manufacturer", "Danish", "DK"),
  tiffany: house(22, "Tiffany Studios", "tiffany-studios", "studio", "American", "US"),
  chelsea: house(
    23,
    "Chelsea Keramic Art Works",
    "chelsea-keramic-art-works",
    "manufacturer",
    "American",
    "US",
  ),
  hardouyn: house(24, "Gilles Hardouyn", "gilles-hardouyn", "printer", "French", "FR"),
  laxStudio: house(25, "LAX Studio", "lax-studio", "studio", "British", "GB"),
  // ── Invented painters behind the top-up's contemporary lots ──
  ellory: person(31, "Margaret Ellory", "margaret-ellory", "British", "GB", "1961"),
  vandeley: person(32, "Anton Vandeley", "anton-vandeley", "Belgian", "BE", "1948"),
  harcourtBeale: person(
    33,
    "Isobel Harcourt-Beale",
    "isobel-harcourt-beale",
    "British",
    "GB",
    "1974",
  ),
  okonkwo: person(34, "Tunde Okonkwo-Reid", "tunde-okonkwo-reid", "British", "GB", "1969"),
  marchetti: person(35, "Livia Marchetti", "livia-marchetti", "Italian", "IT", "1983"),
  thornley: person(36, "Hugh Thornley", "hugh-thornley", "British", "GB", "1937", "2011"),
} as const satisfies Record<string, DemoArtist>;

export type DemoArtistKey = keyof typeof DEMO_ARTISTS;

/** Every artist the demo registers, in id order. */
export const DEMO_ARTIST_LIST: DemoArtist[] = Object.values(DEMO_ARTISTS);

/** The artist behind each full-catalogue work; `null` where the maker is not known by name. */
export const WORK_ARTIST: Record<WorkKey, DemoArtistKey | null> = {
  danceClass: "degas",
  venice: "turner",
  argenteuil: "manet",
  berceuse: "vanGogh",
  ageOfBronze: "rodin",
  bronzeHorse: null,
  crouchingVenus: "giambologna",
  sete: "leGray",
  muybridge: "muybridge",
  vivienMerlin: "cameron",
  flowField: "laxStudio",
  creche: null,
  threeDancers: "degas",
  violinist: "degas",
  danielPraying: "hunt",
  threeWomen: "rembrandt",
  breguet: "breguet",
  roskell: "roskell",
  perigal: "perigal",
  leRoyClock: "leRoy",
  brockbank: "brockbank",
  streamline: "boysen",
  stater: null,
  parisii: null,
  denarius: null,
  tiffanyLamp: "tiffany",
  bugattiTable: "carloBugatti",
  bugattiCabinet: "carloBugatti",
  chelseaVase: "chelsea",
  greatWave: "hokusai",
  orientalHead: "rembrandt",
  janLutma: "rembrandt",
  cardinalAlbrecht: "durer",
  erasmus: "durer",
  hiroshige: "hiroshige",
  hardouyn: "hardouyn",
  lastJudgment: null,
  leafSaint: null,
  leafHours: null,
};

/** Works with no artist, and why. The seed test fails for any other lot without one. */
export const UNATTRIBUTED_WORKS: Partial<Record<WorkKey, string>> = {
  bronzeHorse: "Greek Geometric votive bronze: anonymous",
  creche: "Neapolitan crib figures: anonymous workshop",
  stater: "Ancient Greek coin: issued by a city, no named maker",
  parisii: "Gallic tribal coin: no named maker",
  denarius: "Roman imperial coin: no named maker",
  lastJudgment: "Medieval Book of Hours leaf: anonymous illuminator",
  leafSaint: "Medieval Book of Hours leaf: anonymous illuminator",
  leafHours: "Medieval Book of Hours leaf: anonymous illuminator",
};

/** The painter of each top-up lot, by title. */
export const TOPUP_LOT_ARTIST: Record<string, DemoArtistKey> = {
  "Harbour at First Light": "ellory",
  "Blue Interior with Lemons": "harcourtBeale",
  "Still Life with Peonies": "harcourtBeale",
  "Estuary, Evening": "ellory",
  "Study in Ochre": "okonkwo",
  "The Long Field": "thornley",
  "Night Garden": "marchetti",
  "Abstract in Cobalt": "okonkwo",
  "Thames at Chelsea Reach": "thornley",
  "Woman Reading": "vandeley",
  "Lowland Storm": "vandeley",
  "Composition, Red and Black": "okonkwo",
  "Garden Flowers in a Glass Vase": "harcourtBeale",
  "The Valley in Spring": "thornley",
  "Morning Sea": "ellory",
  "Figures on a Beach": "vandeley",
  "Flowers for Ana": "marchetti",
  "Head of a Young Man": "vandeley",
  "Blue Abstract No. 3": "okonkwo",
  "Coastal Notation": "ellory",
  "Morning Rain, Kensington": "marchetti",
  "Quiet Harbour": "ellory",
  "Field Notes II": "thornley",
  "Red Kite": "marchetti",
  "Lantern Study": "vandeley",
  "Pale Shore": "ellory",
  "Winter Orchard": "thornley",
  "The Lock Keeper's House": "thornley",
  "Grey Morning": "harcourtBeale",
};

export const workArtistId = (work: WorkKey): string | null => {
  const key = WORK_ARTIST[work];
  return key ? DEMO_ARTISTS[key].id : null;
};

export const topupLotArtistId = (title: string): string | null => {
  const key = TOPUP_LOT_ARTIST[title];
  return key ? DEMO_ARTISTS[key].id : null;
};
