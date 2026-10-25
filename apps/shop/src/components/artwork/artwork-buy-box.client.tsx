"use client";

import { addArtworkToBasket, removeBasketLine } from "@/app/actions/basket.actions";
import { BasketAddedPanel } from "@/components/artwork/basket-added-panel.client";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { addToBasketErrorMessage } from "@/lib/artwork/add-to-basket-error";
import type { ArtworkPurchaseVm } from "@/lib/presenters/artwork-purchase.presenter";
import {
  MarketingCheckIcon,
  MarketingSpinnerIcon,
  MarketingStickyActionBar,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";

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
  /** Delivery and returns lines, rendered under the button. */
  facts: ReactNode;
};

type Phase = "idle" | "adding" | "added";
type Placement = "main" | "bar";

function focusFirstControl(container: HTMLElement | null) {
  container?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
}

/**
 * The buy block: price with VAT, the edition line, "Add to basket" and the delivery and returns
 * lines. Adding shows a loading then a success state, opens the basket confirmation, refreshes the
 * header count and is announced to screen readers. On a phone a bar with the price and the same
 * action appears once the main button has scrolled out of view.
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
  facts,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [inBasket, setInBasket] = useState(initialInBasket);
  const [error, setError] = useState<{ message: string; signIn: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
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

  async function add(placement: Placement) {
    if (phase === "adding") return;
    addedFrom.current = placement;
    setError(null);
    setAnnouncement("");
    setPhase("adding");
    const result = await addArtworkToBasket(slug, 1);
    if (!result.ok) {
      setPhase("idle");
      const message = addToBasketErrorMessage(result.error);
      setError(message);
      setAnnouncement(message.message);
      return;
    }
    setPhase("added");
    setInBasket(true);
    setAnnouncement(`${title} added to your basket.`);
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
        <ShopCommerceButton href="/basket" className={className}>
          View basket
        </ShopCommerceButton>
      );
    }
    return (
      <ShopCommerceButton
        type="button"
        className={className}
        aria-busy={phase === "adding"}
        disabled={phase === "adding"}
        onClick={() => void add(placement)}
      >
        {phase === "adding" ? (
          <>
            <MarketingSpinnerIcon />
            Adding…
          </>
        ) : (
          "Add to basket"
        )}
      </ShopCommerceButton>
    );
  }

  return (
    <div className="shop-buy">
      <div className="shop-buy__price">
        <p className="shop-buy__amount">{purchase.priceLabel}</p>
        <p className="shop-buy__vat">{purchase.vatNote}</p>
      </div>
      <p className="shop-buy__edition">
        {purchase.editionSize}
        <span aria-hidden="true"> · </span>
        <span className="shop-buy__availability" data-state={purchase.availability}>
          {purchase.availabilityLabel}
        </span>
      </p>

      <div ref={actionRef} className="shop-buy__action">
        {actionButton("main")}
        {inBasket && phase !== "added" ? (
          <p className="shop-buy__in-basket">
            In your basket.{" "}
            <Button
              type="button"
              variant="link"
              size="link"
              className="shop-buy__remove shop-focus-ring"
              disabled={removing || !basketLineId}
              onClick={remove}
            >
              {removing ? "Removing…" : "Remove"}
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

      {facts}

      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>

      {barVisible ? (
        <MarketingStickyActionBar ariaLabel="Buy this edition" className="shop-buy-bar">
          <div className="shop-buy-bar__price">
            <p className="shop-buy-bar__amount">{purchase.priceLabel}</p>
            <p className="shop-buy-bar__vat">{purchase.vatNote}</p>
          </div>
          <div ref={barRef} className="shop-buy-bar__action">
            {actionButton("bar")}
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
          editionSize: purchase.editionSize,
          priceLabel: purchase.priceLabel,
        }}
      />
    </div>
  );
}
