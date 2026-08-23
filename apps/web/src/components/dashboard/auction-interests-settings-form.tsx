"use client";

import { INITIAL_AUCTION_INTERESTS_SETTINGS_ACTION_STATE } from "@/app/dashboard/settings/interests/action-state";
import { saveAuctionInterestPreferences } from "@/app/dashboard/settings/interests/actions";
import { MediaImage } from "@/components/ui/media-image";
import { BUYER_INTERESTS } from "@/lib/onboarding/buyer-interest-manifest";
import { notify } from "@/lib/ui/notify";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  categoryIdBySlug: Readonly<Record<string, string>>;
  initialCategoryIds: readonly string[];
};

function SaveInterestsButton({ catalogIncomplete }: { catalogIncomplete: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || catalogIncomplete}
      aria-disabled={pending || catalogIncomplete}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending ? "Saving…" : "Save interests"}
    </Button>
  );
}

export function AuctionInterestsSettingsForm({ categoryIdBySlug, initialCategoryIds }: Props) {
  const router = useRouter();
  const handledRedirect = useRef<string | null>(null);
  const [selected, setSelected] = useState(() => new Set(initialCategoryIds));
  const [actionState, formAction] = useActionState(
    saveAuctionInterestPreferences,
    INITIAL_AUCTION_INTERESTS_SETTINGS_ACTION_STATE,
  );
  const missingInterests = BUYER_INTERESTS.filter(
    (interest) => !categoryIdBySlug[interest.categorySlug],
  );
  const catalogIncomplete = missingInterests.length > 0;

  useEffect(() => {
    if (!actionState.error) return;
    notify.error("Couldn’t save your auction interests", {
      id: "auction-interests-settings-save-failed",
      description: actionState.error,
    });
  }, [actionState.error]);

  useEffect(() => {
    if (!actionState.redirectTo || handledRedirect.current === actionState.redirectTo) return;
    handledRedirect.current = actionState.redirectTo;
    router.replace(actionState.redirectTo);
  }, [actionState.redirectTo, router]);

  return (
    <form action={formAction} className="space-y-6">
      {[...selected].map((categoryId) => (
        <input key={categoryId} type="hidden" name="categoryId" value={categoryId} />
      ))}
      <p className="text-sm text-on-surface-variant">
        Choose the categories you want to see across recommendations and discovery. You can update
        these any time — changes here do not repeat onboarding.
      </p>
      {catalogIncomplete ? (
        <Alert role="alert">
          <AlertTitle>Some categories are temporarily unavailable</AlertTitle>
          <AlertDescription>
            {BUYER_INTERESTS.length - missingInterests.length} of {BUYER_INTERESTS.length} interest
            categories are available right now. Saving is disabled until the full catalogue is
            restored.
          </AlertDescription>
        </Alert>
      ) : null}
      <fieldset className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <legend className="sr-only">Auction interests</legend>
        {BUYER_INTERESTS.map((interest, index) => {
          const categoryId = categoryIdBySlug[interest.categorySlug];
          if (!categoryId) {
            return (
              <div
                key={interest.key}
                aria-disabled="true"
                className="relative flex h-[190px] flex-col overflow-hidden rounded-xl border border-outline-variant/40 bg-surface opacity-60 shadow-sm sm:h-[clamp(170px,23vh,239px)]"
              >
                <div className="relative min-h-0 flex-1 overflow-hidden bg-surface-container">
                  <MediaImage
                    src={interest.image}
                    alt=""
                    label={interest.label}
                    sizes="(min-width: 1024px) 232px, (min-width: 640px) 46vw, 44vw"
                    className="h-full grayscale"
                    priority={index === 0}
                  />
                </div>
                <span className="flex h-[62px] shrink-0 items-center justify-center px-2 text-center text-base font-semibold leading-[26px]">
                  {interest.label}
                </span>
                <span className="absolute right-2.5 top-2.5 rounded bg-surface/90 px-2 py-1 text-xs font-semibold text-on-surface shadow-sm">
                  Unavailable
                </span>
              </div>
            );
          }
          const checked = selected.has(categoryId);
          const controlId = `settings-interest-${interest.key}`;
          return (
            <label
              key={interest.key}
              htmlFor={controlId}
              className={`group relative flex h-[190px] cursor-pointer flex-col overflow-hidden rounded-xl border bg-surface shadow-sm transition-[border-color,box-shadow,transform] duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 motion-reduce:transition-none sm:h-[clamp(170px,23vh,239px)] ${
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
      <SaveInterestsButton catalogIncomplete={catalogIncomplete} />
    </form>
  );
}
