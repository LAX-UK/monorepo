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
import { Button } from "@auction/ui/lax";
import { MoreVertical } from "lucide-react";
import { useState } from "react";

type Props = {
  isSubmitting: boolean;
  /** False on the last step, which has its own "Save and finish later". */
  showFinishLater?: boolean;
  onFinishLater: () => void;
  onLeaveWithoutSaving: () => void;
};

export function WizardHeaderActions({
  isSubmitting,
  showFinishLater = true,
  onFinishLater,
  onLeaveWithoutSaving,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const leaveWithoutSaving = () => {
    setMenuOpen(false);
    onLeaveWithoutSaving();
  };

  return (
    <>
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {showFinishLater ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={isSubmitting}
            onClick={onFinishLater}
            data-testid="wizard-finish-later"
          >
            {SUBMISSION_FINISH_LATER_LABEL}
          </Button>
        ) : null}
      </div>

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen}>
        <BottomSheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            className="sm:hidden"
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
            {showFinishLater ? (
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
            ) : null}
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
