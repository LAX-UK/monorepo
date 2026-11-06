export { closeDb, createDb, createDbFromPool, type Database } from "./client.js";
export * from "./schema/index.js";
export { saleNotDeleted, lotNotDeleted, venueNotDeleted } from "./lib/soft-delete-filters.js";
export {
  publishUserRegistered,
  type PublishUserRegisteredInput,
  type PublishUserRegisteredOptions,
  type PublishUserRegisteredResult,
  type UserRegisteredSource,
} from "./services/publish-user-registered.js";
export {
  persistQrCodeScan,
  truncateIp,
  type QrCodeScanInput,
} from "./services/qr-code-scan.js";
export {
  DEMO_IMAGE_LONG_EDGE,
  DEMO_JPEG_QUALITY,
  DEMO_MEDIA_BASE_URL,
  DEMO_PORTRAIT_SOURCES,
  demoImageCatalogue,
  demoImageKey,
  demoImageUrl,
  demoPortraitUrl,
  type DemoImageEntry,
  type DemoImageKind,
} from "./seed/demo/demo-images.js";
