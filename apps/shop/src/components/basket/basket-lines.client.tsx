"use client";

import {
  addArtworkToBasket,
  addMerchandiseVariantToBasket,
  removeBasketLine,
  setBasketLineQuantity,
  setMerchandiseBasketLineQuantity,
} from "@/app/actions/basket.actions";
import { BasketSummary } from "@/components/basket/basket-summary";
import { ShopQuantityStepper } from "@/components/commerce/shop-quantity-stepper";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import {
  type BasketLineVm,
  basketLineStepperHint,
  presentBasketLine,
} from "@/lib/basket/basket-view.vm";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { MarketingTrashIcon } from "@auction/marketing-ui";
import type { BasketLine } from "@auction/shop-contracts";
import { formatGbpPence } from "@auction/shop-portal/vm";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";

/** How long Undo stays offered after Remove. */
export const BASKET_UNDO_MS = 10_000;

type Props = {
  lines: BasketLine[];
  /** Checkout action and policy links under the order summary; null hides the summary. */
  summaryActions?: ReactNode;
  /** Shown when nothing is left, under any Undo rows, so the last removal can still be undone. */
  emptyState: ReactNode;
};

type RemovedEntry = { vm: BasketLineVm; index: number };

function errorMessage(error: unknown): string {
  return commerceErrorMessage(error, "We could not update your basket. Try again.");
}

function BasketLineThumbnail({ vm }: { vm: BasketLineVm }) {
  const image = vm.imageUrl ? (
    <Image src={vm.imageUrl} alt={vm.imageAlt} fill sizes="(min-width: 40rem) 7rem, 5rem" />
  ) : null;
  // The title link carries the name; the picture repeats it, so it is skipped by keyboard and
  // screen reader.
  return vm.href ? (
    <Link
      href={vm.href}
      className="shop-basket__thumb marketing-work-mat"
      tabIndex={-1}
      aria-hidden
    >
      {image}
    </Link>
  ) : (
    <div className="shop-basket__thumb marketing-work-mat" aria-hidden>
      {image}
    </div>
  );
}

export function BasketLinesClient({ lines, summaryActions, emptyState }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [removed, setRemoved] = useState<RemovedEntry[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
    };
  }, []);

  const vms = lines.map(presentBasketLine);

  function forgetRemoved(lineId: string) {
    const timer = timers.current.get(lineId);
    if (timer) clearTimeout(timer);
    timers.current.delete(lineId);
    setRemoved((current) => current.filter((entry) => entry.vm.lineId !== lineId));
  }

  function changeQuantity(vm: BasketLineVm, next: number) {
    const previous = quantities[vm.lineId] ?? vm.quantity;
    if (!Number.isInteger(next) || next < 1 || next > vm.maxQuantity || next === previous) return;
    setMessage(null);
    setQuantities((current) => ({ ...current, [vm.lineId]: next }));
    startTransition(async () => {
      const result =
        vm.restore?.kind === "merchandise"
          ? await setMerchandiseBasketLineQuantity(vm.restore.variantId, next)
          : vm.restore?.kind === "edition"
            ? await setBasketLineQuantity(vm.restore.artworkSlug, next)
            : { ok: false as const, error: {} };
      if (!result.ok) {
        setQuantities((current) => ({ ...current, [vm.lineId]: previous }));
        setMessage(errorMessage(result.error));
        return;
      }
      router.refresh();
    });
  }

  function remove(vm: BasketLineVm, index: number) {
    setMessage(null);
    startTransition(async () => {
      const result = await removeBasketLine(vm.lineId);
      if (!result.ok) {
        setMessage(errorMessage(result.error));
        return;
      }
      const quantity = quantities[vm.lineId] ?? vm.quantity;
      setRemoved((current) => [...current, { vm: { ...vm, quantity }, index }]);
      timers.current.set(
        vm.lineId,
        setTimeout(() => forgetRemoved(vm.lineId), BASKET_UNDO_MS),
      );
      setAnnouncement(`${vm.title} removed from your basket.`);
      router.refresh();
    });
  }

  function undo(entry: RemovedEntry) {
    const { vm } = entry;
    if (!vm.restore) return;
    const restore = vm.restore;
    setMessage(null);
    startTransition(async () => {
      const result =
        restore.kind === "merchandise"
          ? await addMerchandiseVariantToBasket(restore.variantId, vm.quantity)
          : await addArtworkToBasket(restore.artworkSlug, vm.quantity);
      forgetRemoved(vm.lineId);
      if (!result.ok) {
        setMessage(
          `We could not put ${vm.title} back in your basket. ${errorMessage(result.error)}`,
        );
        return;
      }
      setAnnouncement(`${vm.title} is back in your basket.`);
      router.refresh();
    });
  }

  // Undo rows keep the place the line had, so the list does not jump when one is removed.
  const rows: Array<{ kind: "line"; vm: BasketLineVm } | { kind: "removed"; entry: RemovedEntry }> =
    vms.map((vm) => ({ kind: "line" as const, vm }));
  for (const entry of [...removed].sort((a, b) => a.index - b.index)) {
    if (vms.some((vm) => vm.lineId === entry.vm.lineId)) continue;
    rows.splice(Math.min(entry.index, rows.length), 0, { kind: "removed", entry });
  }

  return (
    <>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {message ? (
        <ShopNotice tone="error" title="Your basket was not updated">
          {message}
        </ShopNotice>
      ) : null}
      {rows.length > 0 ? (
        <div className={vms.length > 0 ? "shop-basket__layout" : "shop-basket__layout--single"}>
          <section aria-labelledby="basket-lines-heading" className="shop-basket__lines-panel">
            <h2 id="basket-lines-heading" className="sr-only">
              Items in your basket
            </h2>
            <ul className="shop-basket__lines">
              {rows.map((row, index) =>
                row.kind === "removed" ? (
                  <li
                    key={`removed-${row.entry.vm.lineId}`}
                    className="shop-basket__line shop-basket__line--removed"
                  >
                    <p className="shop-basket__removed-text">
                      <span className="shop-basket__removed-title">{row.entry.vm.title}</span> was
                      removed.
                    </p>
                    {row.entry.vm.restore ? (
                      <ShopCommerceButton
                        type="button"
                        variant="outline"
                        className="shop-basket__undo"
                        disabled={pending}
                        aria-label={`Undo removing ${row.entry.vm.title}`}
                        onClick={() => undo(row.entry)}
                      >
                        Undo
                      </ShopCommerceButton>
                    ) : null}
                  </li>
                ) : (
                  <BasketLineRow
                    key={row.vm.lineId}
                    vm={row.vm}
                    line={lines.find((line) => line.lineId === row.vm.lineId)}
                    quantity={quantities[row.vm.lineId] ?? row.vm.quantity}
                    pending={pending}
                    onQuantity={(next) => changeQuantity(row.vm, next)}
                    onRemove={() => remove(row.vm, index)}
                  />
                ),
              )}
            </ul>
          </section>
          {vms.length > 0 && summaryActions ? (
            <aside aria-labelledby="basket-summary-heading" className="shop-basket__summary-panel">
              <BasketSummary
                lines={vms.map((vm) => ({
                  unitPricePence: vm.unitPricePence,
                  quantity: quantities[vm.lineId] ?? vm.quantity,
                }))}
                actions={summaryActions}
              />
            </aside>
          ) : null}
        </div>
      ) : null}
      {vms.length === 0 ? emptyState : null}
    </>
  );
}

function BasketLineRow({
  vm,
  line,
  quantity,
  pending,
  onQuantity,
  onRemove,
}: {
  vm: BasketLineVm;
  line: BasketLine | undefined;
  quantity: number;
  pending: boolean;
  onQuantity: (next: number) => void;
  onRemove: () => void;
}) {
  const router = useRouter();
  return (
    <li className="shop-basket__line">
      <BasketLineThumbnail vm={vm} />
      <div className="shop-basket__line-body">
        <div className="shop-basket__line-head">
          <div className="shop-basket__line-identity">
            <h3 className="shop-basket__line-title">
              {vm.href ? (
                <Link href={vm.href} className="shop-basket__line-link shop-focus-ring">
                  {vm.title}
                </Link>
              ) : (
                vm.title
              )}
            </h3>
            {vm.artistName ? (
              <p className="shop-basket__line-artist">
                {vm.artistHref ? (
                  <Link href={vm.artistHref} className="shop-basket__line-link shop-focus-ring">
                    {vm.artistName}
                  </Link>
                ) : (
                  vm.artistName
                )}
              </p>
            ) : null}
            {vm.detail ? <p className="shop-basket__line-meta">{vm.detail}</p> : null}
          </div>
          <p className="shop-basket__line-price">
            <span className="shop-basket__line-total">
              {formatGbpPence(vm.unitPricePence * quantity)}
            </span>
            {quantity > 1 ? (
              <span className="shop-basket__line-unit">{vm.unitPrice} each</span>
            ) : null}
          </p>
        </div>
        {line?.priceChanged ? (
          <ShopNotice tone="warning" title="The price has changed">
            <p>Update the basket to see the new price before checkout.</p>
            <ShopCommerceButton
              type="button"
              variant="outline"
              className="mt-2"
              disabled={pending}
              onClick={() => router.refresh()}
            >
              Update prices
            </ShopCommerceButton>
          </ShopNotice>
        ) : null}
        {line?.outOfStock && line.soldOut ? (
          <ShopNotice tone="warning" title="Sold out">
            <p>This edition has sold out. Remove it to continue to checkout.</p>
          </ShopNotice>
        ) : line?.outOfStock ? (
          <ShopNotice tone="warning" title="Quantity not available">
            <p>We cannot supply this quantity. Lower it or remove the item to continue.</p>
          </ShopNotice>
        ) : null}
        <div className="shop-basket__line-actions">
          {line?.soldOut ? null : (
            <ShopQuantityStepper
              value={quantity}
              max={Math.max(vm.maxQuantity, 1)}
              itemLabel={vm.title}
              hint={basketLineStepperHint(vm, quantity)}
              disabled={pending}
              onChange={onQuantity}
            />
          )}
          <button
            type="button"
            className="shop-basket__remove shop-focus-ring"
            disabled={pending}
            aria-label={`Remove ${vm.title}`}
            onClick={onRemove}
          >
            <MarketingTrashIcon className="size-4" />
            <span>Remove</span>
          </button>
        </div>
      </div>
    </li>
  );
}
