import type { CatalogLot } from "./catalog-lot.js";
import { buildCarouselLots, modelTHighlight } from "./featured-lots.js";
import { fetchLinkedSaleCatalog, fetchOnsiteCatalog } from "./sale-catalog-api.js";

export type LotCarouselOptions = {
  saleId?: string | null;
  saleTitle?: string | null;
  includeModelTHighlight?: boolean;
};

export async function initLotCarousel(opts?: LotCarouselOptions): Promise<void> {
  const root = document.getElementById("lot-carousel");
  if (!root) return;

  root.setAttribute("aria-busy", "true");
  root.classList.add("lot-carousel--loading");

  const includeModelTHighlight = opts?.includeModelTHighlight !== false;
  let lots: CatalogLot[];
  try {
    if (opts?.saleId && opts?.saleTitle) {
      const catalog = await fetchLinkedSaleCatalog(opts.saleId, opts.saleTitle);
      lots = buildCarouselLots(catalog.lots, {
        modelTHref: catalog.modelTHref,
        includeModelTHighlight,
      });
    } else {
      const catalog = await fetchOnsiteCatalog();
      lots = buildCarouselLots(catalog.lots, {
        modelTHref: catalog.modelTHref,
        includeModelTHighlight,
      });
    }
  } catch {
    lots = includeModelTHighlight ? [modelTHighlight()] : [];
  }

  renderLotCarousel(root, lots);
}

function renderLotCarousel(root: HTMLElement, lots: CatalogLot[]): void {
  const track = document.createElement("div");
  track.className = "lot-carousel__track";
  track.setAttribute("role", "list");

  for (const lot of lots) {
    track.append(renderLotCard(lot));
  }

  const viewport = document.createElement("div");
  viewport.className = "lot-carousel__viewport";
  viewport.append(track);

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "lot-carousel__nav lot-carousel__nav--prev";
  prev.setAttribute("aria-label", "Previous lot");
  prev.textContent = "‹";

  const next = document.createElement("button");
  next.type = "button";
  next.className = "lot-carousel__nav lot-carousel__nav--next";
  next.setAttribute("aria-label", "Next lot");
  next.textContent = "›";

  const dots = document.createElement("div");
  dots.className = "lot-carousel__dots";
  dots.setAttribute("role", "tablist");
  dots.setAttribute("aria-label", "Featured lots");

  root.replaceChildren(viewport, prev, next, dots);
  root.classList.remove("lot-carousel--loading");
  root.classList.add("is-ready");
  root.setAttribute("aria-busy", "false");

  const cards = [...track.querySelectorAll<HTMLElement>(".lot-card")];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card) continue;
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "lot-carousel__dot";
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", `Lot ${i + 1}`);
    dot.addEventListener("click", () => scrollToCard(card));
    dots.append(dot);
  }

  const update = () => {
    const index = activeIndex(track, cards);
    for (const [i, dot] of [...dots.children].entries()) {
      dot.classList.toggle("is-active", i === index);
    }
    prev.disabled = index <= 0;
    next.disabled = index >= cards.length - 1;
  };

  prev.addEventListener("click", () => {
    const index = activeIndex(track, cards);
    const target = index > 0 ? cards[index - 1] : undefined;
    if (target) scrollToCard(target);
  });

  next.addEventListener("click", () => {
    const index = activeIndex(track, cards);
    const target = index < cards.length - 1 ? cards[index + 1] : undefined;
    if (target) scrollToCard(target);
  });

  track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
  update();
}

function renderLotCard(lot: CatalogLot): HTMLElement {
  const card = document.createElement("article");
  card.className = `lot-card${lot.featured ? " lot-card--featured" : ""}`;
  card.setAttribute("role", "listitem");

  if (lot.href) {
    const link = document.createElement("a");
    link.className = "lot-card__link";
    link.href = lot.href;
    link.target = "_blank";
    link.rel = "noopener";
    link.append(renderLotCardInner(lot));
    card.append(link);
  } else {
    card.append(renderLotCardInner(lot));
  }

  return card;
}

function renderLotCardInner(lot: CatalogLot): DocumentFragment {
  const fragment = document.createDocumentFragment();

  if (lot.image) {
    const media = document.createElement("div");
    media.className = "lot-card__media";
    const img = document.createElement("img");
    img.src = lot.image;
    img.alt = lot.title;
    img.loading = "lazy";
    media.append(img);
    fragment.append(media);
  } else {
    const media = document.createElement("div");
    media.className = "lot-card__media lot-card__media--text";
    media.append(textEl("span", "lot-card__category", lot.category));
    fragment.append(media);
  }

  const body = document.createElement("div");
  body.className = "lot-card__body";
  body.append(textEl("p", "lot-card__category", lot.category));
  body.append(textEl("h3", "lot-card__title", lot.title));
  body.append(renderStat("Estimate", lot.estimate));
  body.append(renderStat("Opening bid", lot.openingBid, true));
  fragment.append(body);

  return fragment;
}

function renderStat(label: string, value: string, accent = false): HTMLElement {
  const row = document.createElement("div");
  row.className = `lot-card__stat${accent ? " lot-card__stat--accent" : ""}`;
  row.append(textEl("span", "lot-card__stat-label", label));
  row.append(textEl("span", "lot-card__stat-value", value));
  return row;
}

function textEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function scrollToCard(card: HTMLElement): void {
  card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}

function activeIndex(track: HTMLElement, cards: HTMLElement[]): number {
  const center = track.scrollLeft + track.clientWidth / 2;
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [i, card] of cards.entries()) {
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const dist = Math.abs(cardCenter - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}
