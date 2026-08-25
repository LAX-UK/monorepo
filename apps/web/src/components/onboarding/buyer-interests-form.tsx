"use client";

import { INITIAL_BUYER_INTERESTS_ACTION_STATE } from "@/app/(task)/onboarding/interests/action-state";
import { completeBuyerInterests } from "@/app/(task)/onboarding/interests/actions";
import { trackBuyerInterestsSubmission } from "@/components/onboarding/buyer-onboarding-analytics";
import {
  onboardingActions,
  onboardingPrimaryButton,
  onboardingTextButton,
} from "@/components/onboarding/buyer-onboarding-shell";
import { MediaImage } from "@/components/ui/media-image";
import type { FullBuyerOnboardingSource } from "@/lib/kyc/buyer-onboarding";
import { BUYER_INTERESTS } from "@/lib/onboarding/buyer-interest-manifest";
import { notify } from "@/lib/ui/notify";
import { reconcileBuyerInterestSelection } from "@auction/domain";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  next: string;
  source: FullBuyerOnboardingSource;
  categoryIdBySlug: Readonly<Record<string, string>>;
  initialCategoryIds: readonly string[];
};

function BuyerInterestActions({
  selectedCount,
}: {
  selectedCount: number;
}) {
  const { pending } = useFormStatus();

  return (
    <div className={onboardingActions}>
      <Button
        type="submit"
        name="skip"
        value="1"
        variant="ghost"
        disabled={pending}
        className={onboardingTextButton}
      >
        Skip personalization
      </Button>
      <Button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className={`${onboardingPrimaryButton} w-full sm:w-auto`}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? "Saving…" : "Continue"}
      </Button>
      <span className="sr-only" aria-live="polite">
        {pending ? "Saving your interests" : ""}
        {selectedCount > 0 ? `${selectedCount} selected` : ""}
      </span>
    </div>
  );
}

export function BuyerInterestsForm({ next, source, categoryIdBySlug, initialCategoryIds }: Props) {
  const { replace } = useRouter();
  const [selected, setSelected] = useState(
    () =>
      new Set(
        reconcileBuyerInterestSelection({
          selectedIds: initialCategoryIds,
          availableCatalogIds: Object.values(categoryIdBySlug),
        }).selectedAvailableIds,
      ),
  );
  const [actionState, formAction] = useActionState(
    completeBuyerInterests,
    INITIAL_BUYER_INTERESTS_ACTION_STATE,
  );

  useEffect(() => {
    if (!actionState.error) return;
    notify.error("Couldn’t save your interests", {
      id: "buyer-interests-save-failed",
      description: actionState.error,
    });
  }, [actionState.error]);

  useEffect(() => {
    if (!actionState.redirectTo || !actionState.submission) return;
    trackBuyerInterestsSubmission(actionState.submission);
    replace(actionState.redirectTo);
  }, [actionState.redirectTo, actionState.submission, replace]);

  return (
    <form action={formAction} className="flex w-full flex-col gap-8 sm:gap-10">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="source" value={source} />
      {[...selected].map((categoryId) => (
        <input key={categoryId} type="hidden" name="categoryId" value={categoryId} />
      ))}
      <fieldset className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <legend className="sr-only">Choose your areas of interest</legend>
        {BUYER_INTERESTS.map((interest, index) => {
          const categoryId = categoryIdBySlug[interest.categorySlug];
          if (!categoryId) return null;
          const checked = selected.has(categoryId);
          const controlId = `buyer-interest-${interest.key}`;
          return (
            <label
              key={interest.key}
              htmlFor={controlId}
              className={`group relative flex h-[190px] cursor-pointer flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none sm:h-[clamp(170px,23vh,239px)] ${
                checked
                  ? "border-[#081f5b] shadow-md ring-2 ring-[#081f5b] ring-offset-2"
                  : "border-[#e1e1e1] hover:-translate-y-0.5 hover:border-[#9aa7c7] hover:shadow-md"
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
                  imgClassName="transition-[opacity,transform] duration-500 motion-reduce:transition-none group-hover:scale-[1.025]"
                  priority={index === 0}
                />
              </div>
              <span className="flex h-[62px] shrink-0 items-center justify-center px-2 text-center text-base font-semibold leading-[26px] sm:text-lg">
                {interest.label}
              </span>
              <span
                aria-hidden
                className={`absolute right-2.5 top-2.5 flex size-6 items-center justify-center border transition-colors ${
                  checked
                    ? "border-[#081f5b] bg-[#081f5b] text-white shadow-sm"
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
      <BuyerInterestActions selectedCount={selected.size} />
    </form>
  );
}
