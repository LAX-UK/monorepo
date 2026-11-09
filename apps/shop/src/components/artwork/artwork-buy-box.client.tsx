"use client";

import { addArtworkToBasket, removeBasketLine } from "@/app/actions/basket.actions";
import { useFramingChoice } from "@/components/artwork/artwork-framing-context.client";
import { ArtworkFramingGroup } from "@/components/artwork/artwork-framing-group.client";
import { BasketAddedPanel } from "@/components/artwork/basket-added-panel.client";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { EDITION_PAGE_COPY } from "@/content/artwork-edition-copy";
import { FRAMING_COPY } from "@/content/framing-copy";
import { addToBasketErrorMessage } from "@/lib/artwork/add-to-basket-error";
import { type ArtworkFramingVm, choiceById } from "@/lib/artwork/artwork-framing.vm";
import type { ArtworkPurchaseVm } from "@/lib/presenters/artwork-purchase.presenter";
import {
  MarketingCheckIcon,
  MarketingSpinnerIcon,
  MarketingStickyActionBar,
  useClaimBottomSlot,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/** How long the button says "Added" before it becomes "View basket". */
const ADDED_FLASH_MS = 2000;

type Props = {
  slug: string;
  title: string;
  artistName: string;
  imageUrl: string | null;
  purchase: ArtworkPurchaseVm;
  inBasket: boolean;
  basketLineId: string | null;
  /** Sign in and come back to this page, for a guest asked to sign in first. */
  signInHref: string;
  /** "Insured UK delivery £15, arrives 2 to 4 Nov · Free collection, ready Fri 30 Oct". */
  deliveryLine: string;
  /** The delivery policy page, when it is live. */
  deliveryHref: string | null;
  /** The edition as the basket confirmation describes it, from the facts. */
  editionLine: string | null;
  /**
   * Framing that needs no choice: a print that comes framed, or one that cannot be ordered right
   * now. The choice itself comes from the framing context around the buy box.
   */
  framing?: Extract<ArtworkFramingVm, { kind: "framed_by_artist" | "unavailable" }> | null;
  /** The returns policy page when it is live, for the framing details. */
  returnsHref?: string | null;
};

type Phase = "idle" | "adding" | "added";

/** "Includes VAT" read in the middle of a sentence: "includes VAT". */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
type Placement = "main" | "bar";

function focusFirstControl(container: HTMLElement | null) {
  container?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
}

/**
 * The buy block: price with VAT, "Add to basket" and one delivery line. Adding shows a loading
 * then a success state, opens the basket confirmation, refreshes the header count and is
 * announced to screen readers. In the basket, it says so with a way to the basket. On a phone a
 * bar with the price and the same action appears once the main button has scrolled out of view.
 */
export function ArtworkBuyBox({
  slug,
  title,
  artistName,
  imageUrl,
  purchase,
  inBasket: initialInBasket,
  basketLineId,
  signInHref,
  deliveryLine,
  deliveryHref,
  editionLine,
  framing = null,
  returnsHref = null,
}: Props) {
  const router = useRouter();
  const framingChoice = useFramingChoice();
  const [phase, setPhase] = useState<Phase>("idle");
  const [inBasket, setInBasket] = useState(initialInBasket);
  const [error, setError] = useState<{ message: string; signIn: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  /** The shopper pressed Add on a framed-only edition without choosing a frame. */
  const [needsChoice, setNeedsChoice] = useState(false);
  /** What went into the basket, kept for the confirmation after the page switches to "in basket". */
  const [added, setAdded] = useState<{ priceLabel: string; framingName: string | null } | null>(
    null,
  );
  const [barVisible, setBarVisible] = useState(false);
  // The buy bar takes the bottom of the screen; the tab bar steps aside while it shows.
  useClaimBottomSlot("shop-buy-bar", barVisible);
  const [removing, startRemove] = useTransition();
  const actionRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  /** Where the last add came from, so focus returns there when the confirmation closes. */
  const addedFrom = useRef<Placement>("main");

  useEffect(() => {
    setInBasket(initialInBasket);
  }, [initialInBasket]);

  // The phone bar shows once the main button has scrolled up out of view, not before. Measured
  // on scroll rather than with an IntersectionObserver, which misses a jump past the button.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const target = actionRef.current;
      if (target) setBarVisible(target.getBoundingClientRect().bottom < 0);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (phase !== "added") return;
    const timer = window.setTimeout(() => setPhase("idle"), ADDED_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Once it is in the basket, the basket holds the framing; this page shows the print itself.
  const chosen =
    framingChoice && !inBasket ? choiceById(framingChoice.vm, framingChoice.selectedId) : null;
  // A framed-only edition has no default: the shopper picks a frame before the button works.
  const mustChoose = framingChoice !== null && framingChoice.selectedId === undefined;
  const cannotOrder = framing?.kind === "unavailable";
  const priceLabel = chosen ? chosen.totalLabel : purchase.priceLabel;
  const vatNote = chosen
    ? chosen.id === null
      ? `${FRAMING_COPY.unframed} · ${lowerFirst(purchase.vatNote)}`
      : `With ${chosen.name.toLowerCase()} · ${lowerFirst(purchase.vatNote)}`
    : purchase.vatNote;
  const shownDeliveryLine = chosen ? chosen.deliveryLine : deliveryLine;

  async function add(placement: Placement) {
    if (phase === "adding") return;
    // A framed-only edition needs a frame first. The button stays enabled so it can say so: it
    // takes the shopper to the choice and shows the hint, here and in the phone bar.
    if (mustChoose) {
      setNeedsChoice(true);
      setAnnouncement(FRAMING_COPY.requiredIntro);
      document.querySelector<HTMLElement>(".shop-framing [role='radio']")?.focus();
      return;
    }
    addedFrom.current = placement;
    setError(null);
    setAnnouncement("");
    setPhase("adding");
    const snapshot = { priceLabel, framingName: chosen?.id ? chosen.name : null };
    // Where the edition offers a choice, the choice goes with it: an option id, or null for unframed.
    const result = framingChoice
      ? await addArtworkToBasket(slug, 1, framingChoice.selectedId ?? null)
      : await addArtworkToBasket(slug, 1);
    if (!result.ok) {
      setPhase("idle");
      const message = addToBasketErrorMessage(result.error);
      setError(message);
      setAnnouncement(message.message);
      return;
    }
    setPhase("added");
    setAdded(snapshot);
    setInBasket(true);
    setAnnouncement(
      chosen?.id
        ? `${title} with ${chosen.name} added to your basket.`
        : `${title} added to your basket.`,
    );
    setPanelOpen(true);
    router.refresh();
  }

  function remove() {
    if (!basketLineId) return;
    setError(null);
    startRemove(async () => {
      const result = await removeBasketLine(basketLineId);
      if (!result.ok) {
        setError({ message: "We could not update your basket. Try again.", signIn: false });
        return;
      }
      setInBasket(false);
      setAnnouncement(`${title} removed from your basket.`);
      router.refresh();
    });
  }

  // Shown after Add is pressed without a frame, until one is chosen.
  const choiceHint =
    needsChoice && mustChoose && !inBasket ? (
      <p className="shop-buy__hint" role="alert">
        {FRAMING_COPY.requiredIntro}
      </p>
    ) : null;

  function actionButton(placement: Placement) {
    const className = cn("shop-buy__button", placement === "bar" && "shop-buy__button--bar");
    if (phase === "added") {
      return (
        <ShopCommerceButton
          type="button"
          className={cn(className, "shop-buy__button--added")}
          aria-disabled="true"
        >
          <MarketingCheckIcon />
          Added to basket
        </ShopCommerceButton>
      );
    }
    if (inBasket) {
      return (
        <p className={cn("shop-buy__in-basket-line", placement === "bar" && "is-bar")}>
          {EDITION_PAGE_COPY.inBasket} <span aria-hidden="true">·</span>{" "}
          <Link href="/basket" className="shop-inline-link shop-focus-ring">
            {EDITION_PAGE_COPY.viewBasket}
          </Link>
        </p>
      );
    }
    return (
      <ShopCommerceButton
        type="button"
        className={className}
        aria-busy={phase === "adding"}
        disabled={phase === "adding" || cannotOrder}
        onClick={() => void add(placement)}
      >
        {phase === "adding" ? (
          <>
            <MarketingSpinnerIcon />
            Adding…
          </>
        ) : (
          EDITION_PAGE_COPY.addToBasket
        )}
      </ShopCommerceButton>
    );
  }

  return (
    <div className="shop-buy">
      <div className="shop-buy__price">
        <p className="shop-buy__amount">{priceLabel}</p>
        <p className="shop-buy__vat">{vatNote}</p>
      </div>

      {framingChoice && !inBasket ? <ArtworkFramingGroup returnsHref={returnsHref} /> : null}
      {framing?.kind === "framed_by_artist" ? (
        <p className="shop-buy__framed">
          <span className="shop-buy__framed-label">{FRAMING_COPY.framedByArtistHeading}</span>{" "}
          {framing.description}
        </p>
      ) : null}
      {cannotOrder ? (
        <output className="shop-buy__hint">
          <strong>{FRAMING_COPY.unavailable}.</strong> {FRAMING_COPY.unavailableDetail}
        </output>
      ) : null}

      <div ref={actionRef} className="shop-buy__action">
        {actionButton("main")}
        {choiceHint}
        {inBasket && phase !== "added" ? (
          <p className="shop-buy__in-basket">
            <Button
              type="button"
              variant="link"
              size="link"
              className="shop-buy__remove shop-focus-ring"
              disabled={removing || !basketLineId}
              onClick={remove}
            >
              {removing ? "Removing…" : "Remove from basket"}
            </Button>
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="shop-buy__error" role="alert">
          {error.message}
          {error.signIn ? (
            <>
              {" "}
              <Link href={signInHref} className="shop-inline-link shop-focus-ring">
                Sign in
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <p className="shop-buy__delivery">
        {deliveryHref ? (
          <Link href={deliveryHref} className="shop-inline-link shop-focus-ring">
            {shownDeliveryLine}
          </Link>
        ) : (
          shownDeliveryLine
        )}
      </p>

      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>

      {barVisible ? (
        <MarketingStickyActionBar ariaLabel="Buy this edition" className="shop-buy-bar">
          <div className="shop-buy-bar__price">
            <p className="shop-buy-bar__amount">
              {priceLabel} <span className="shop-buy-bar__vat">incl. VAT</span>
            </p>
          </div>
          <div ref={barRef} className="shop-buy-bar__action">
            {actionButton("bar")}
            {choiceHint}
          </div>
        </MarketingStickyActionBar>
      ) : null}

      <BasketAddedPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onClosed={() =>
          focusFirstControl(
            addedFrom.current === "bar" && barRef.current ? barRef.current : actionRef.current,
          )
        }
        item={{
          title,
          artistName,
          imageUrl,
          editionLine,
          priceLabel: added?.priceLabel ?? priceLabel,
          framingName: added ? added.framingName : null,
        }}
      />
    </div>
  );
}
