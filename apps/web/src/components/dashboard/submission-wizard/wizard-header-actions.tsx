"use client";

import {
  SUBMISSION_FINISH_LATER_LABEL,
  SUBMISSION_LEAVE_WITHOUT_SAVING_HINT,
  SUBMISSION_LEAVE_WITHOUT_SAVING_LABEL,
} from "@/lib/marketing/sell-flow-copy";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import { MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  isSubmitting: boolean;
  onFinishLater: () => void;
};

export function WizardHeaderActions({ isSubmitting, onFinishLater }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const leaveWithoutSaving = () => {
    setMenuOpen(false);
    router.push("/dashboard/submissions");
  };

  return (
    <>
      <div className="hidden shrink-0 sm:flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-label text-xs uppercase tracking-wider"
          disabled={isSubmitting}
          onClick={onFinishLater}
          data-testid="wizard-finish-later"
        >
          {SUBMISSION_FINISH_LATER_LABEL}
        </Button>
      </div>

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen}>
        <BottomSheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 sm:hidden"
            aria-label="More actions"
            data-testid="wizard-actions-menu"
          >
            <MoreVertical className="size-5" aria-hidden />
          </Button>
        </BottomSheetTrigger>
        <BottomSheetContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <BottomSheetHeader>
            <BottomSheetTitle className="font-headline text-left text-lg">
              More actions
            </BottomSheetTitle>
          </BottomSheetHeader>
          <ul className="mt-4 flex flex-col gap-1 px-6 pb-6">
            <li>
              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full justify-start font-body text-base"
                disabled={isSubmitting}
                onClick={() => {
                  setMenuOpen(false);
                  onFinishLater();
                }}
                data-testid="wizard-finish-later-mobile"
              >
                {SUBMISSION_FINISH_LATER_LABEL}
              </Button>
            </li>
            <li>
              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full justify-start font-body text-base text-on-surface-variant"
                disabled={isSubmitting}
                onClick={leaveWithoutSaving}
                data-testid="wizard-leave-without-saving"
              >
                {SUBMISSION_LEAVE_WITHOUT_SAVING_LABEL}
              </Button>
              <p className="px-3 pb-2 font-body text-xs text-on-surface-variant">
                {SUBMISSION_LEAVE_WITHOUT_SAVING_HINT}
              </p>
            </li>
          </ul>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
