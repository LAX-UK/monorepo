const PINNED_COMPONENTS = [
  "api",
  "auth",
  "ws",
  "worker",
  "web",
  "migrate",
  "clamav",
  "shop",
  "shop-identity",
  "shop-api",
  "shop-admin",
];

const AUTH_EXCLUDED = process.env.AUTH_TAG_MAP_ENABLED !== "true";

/**
 * Desired App Platform image tag per component: changed components pin to targetSha,
 * unchanged components keep their live tag. Auth is excluded until infra cutover.
 */
export function buildDeployTagMap({ liveTags, affected, targetSha }) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const component of PINNED_COMPONENTS) {
    const live = liveTags[component]?.trim();
    if (!live) continue;
    if (AUTH_EXCLUDED && component === "auth") {
      map[component] = live;
      continue;
    }
    map[component] = affected.includes(component) ? targetSha : live;
  }
  return map;
}

export function filterAffectedForDeploy(affected) {
  if (!AUTH_EXCLUDED) return affected;
  return affected.filter((c) => c !== "auth");
}

export function filterBuildComponents(buildComponents) {
  if (!AUTH_EXCLUDED) return buildComponents;
  return buildComponents.filter((c) => c !== "auth");
}

/** @type {Record<string, string>} */
export const COMPONENT_TO_IMAGE_TAG_ENV = {
  api: "IMAGE_TAG_API",
  auth: "IMAGE_TAG_AUTH",
  ws: "IMAGE_TAG_WS",
  worker: "IMAGE_TAG_WORKER",
  web: "IMAGE_TAG_WEB",
  migrate: "IMAGE_TAG_MIGRATE",
  clamav: "IMAGE_TAG_CLAMAV",
  shop: "IMAGE_TAG_SHOP",
  "shop-identity": "IMAGE_TAG_SHOP_IDENTITY",
  "shop-api": "IMAGE_TAG_SHOP_API",
  "shop-admin": "IMAGE_TAG_SHOP_ADMIN",
};

export function componentRepository(environment, component) {
  return `lax-${environment}-${component}`;
}
