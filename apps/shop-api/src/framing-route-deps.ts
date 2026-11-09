import type { EditionFramingReader } from "./application/framing/edition-framing.ports.js";

export type PublicFramingRoutesDeps = {
  /** SHOP_FRAMING_ENABLED: while off, no edition shows framing and no basket takes it. */
  framingEnabled: boolean;
  reader: EditionFramingReader;
};
