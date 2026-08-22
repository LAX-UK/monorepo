"use client";

import {
  INITIAL_AUCTION_INTERESTS_SETTINGS_ACTION_STATE,
  saveAuctionInterestPreferences,
} from "@/app/dashboard/settings/interests/actions";
import { MediaImage } from "@/components/ui/media-image";
import { BUYER_INTERESTS } from "@/lib/onboarding/buyer-interest-manifest";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import { Check, Loader2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  categoryIdBySlug: Readonly<Record<string, string>>;
  initialCategoryIds: readonly string[];
};

function SaveInterestsButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending ? "Saving…" : "Save interests"}
    </Button>
  );
}

export function AuctionInterestsSettingsForm({ categoryIdBySlug, initialCategoryIds }: Props) {
  const [selected, setSelected] = useState(() => new Set(initialCategoryIds));
  const [actionState, formAction] = useActionState(
    saveAuctionInterestPreferences,
    INITIAL_AUCTION_INTERESTS_SETTINGS_ACTION_STATE,
  );

  useEffect(() => {
    if (!actionState.error) return;
    notify.error("Couldn’t save your auction interests", {
      id: "auction-interests-settings-save-failed",
      description: actionState.error,
    });
  }, [actionState.error]);

  return (
    <form action={formAction} className="space-y-6">
      {[...selected].map((categoryId) => (
        <input key={categoryId} type="hidden" name="categoryId" value={categoryId} />
      ))}
      <p className="text-sm text-on-surface-variant">
        Choose the categories you want to see across recommendations and discovery. You can update
        these any time — changes here do not repeat onboarding.
      </p>
      <fieldset className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <legend className="sr-only">Auction interests</legend>
        {BUYER_INTERESTS.map((interest, index) => {
          const categoryId = categoryIdBySlug[interest.categorySlug];
          if (!categoryId) return null;
          const checked = selected.has(categoryId);
          const controlId = `settings-interest-${interest.key}`;
          return (
            <label
              key={interest.key}
              htmlFor={controlId}
              className={`group relative flex h-[190px] cursor-pointer flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none sm:h-[clamp(170px,23vh,239px)] ${
                checked
                  ? "border-primary shadow-md ring-2 ring-primary ring-offset-2"
                  : "border-outline-variant/40 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              }`}
            >
              <Checkbox
                id={controlId}
                className="sr-only"
                checked={checked}
                aria-label={interest.label}
                onCheckedChange={() =>
                  setSelected((current) => {
                    const updated = new Set(current);
                    if (updated.has(categoryId)) updated.delete(categoryId);
                    else updated.add(categoryId);
                    return updated;
                  })
                }
              />
              <div className="relative min-h-0 flex-1 overflow-hidden bg-surface-container">
                <MediaImage
                  src={interest.image}
                  alt=""
                  label={interest.label}
                  sizes="(min-width: 1024px) 232px, (min-width: 640px) 46vw, 44vw"
                  className="h-full"
                  priority={index === 0}
                />
              </div>
              <span className="flex h-[62px] shrink-0 items-center justify-center px-2 text-center text-base font-semibold leading-[26px]">
                {interest.label}
              </span>
              <span
                aria-hidden
                className={`absolute right-2.5 top-2.5 flex size-6 items-center justify-center border transition-colors ${
                  checked
                    ? "border-primary bg-primary text-on-primary shadow-sm"
                    : "border-white bg-black/10 shadow-sm backdrop-blur-[2px]"
                }`}
              >
                {checked ? <Check className="size-4" /> : null}
              </span>
            </label>
          );
        })}
      </fieldset>
      <span className="sr-only" role="alert" aria-live="assertive">
        {actionState.error}
      </span>
      <SaveInterestsButton />
    </form>
  );
}
