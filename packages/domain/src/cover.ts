/**
 * The cover's pure rules and nothing else, for pages and shared UI that draw a cover. A separate
 * entry keeps the rest of the domain out of their bundles.
 */
export {
  PLATE_FIELD_MIN_CONTRAST,
  contrastRatio,
  parseHex,
  toHex,
  type Rgb,
} from "./cover-colour.js";
export {
  COVER_BOXES,
  boxesServedBySlot,
  coverCrop,
  cropKeepsArea,
  suggestCoverSide,
  type CoverBoxName,
} from "./cover-crop.js";
export {
  BAND_STOPS,
  LINE_MIN_CONTRAST,
  RADIAL_RADIUS,
  RADIAL_STOPS,
  SCRIM_COLOUR,
  TEXT_STYLE,
  lineScrimAlpha,
  scrimSettingFor,
  type TextStyle,
} from "./cover-scrim.js";
export {
  COVER_SLOT_FLOORS,
  COVER_ZOOM_MAX,
  COVER_ZOOM_MIN,
  effectiveCoverSide,
  effectiveCoverSize,
} from "./sale-cover.js";
