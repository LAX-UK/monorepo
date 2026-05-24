"use client";

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
  onSaveDraft: () => void;
  onSaveAndLeave: () => void;
};

export function WizardHeaderActions({ isSubmitting, onSaveDraft, onSaveAndLeave }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const exitWithoutSaving = () => {
    setMenuOpen(false);
    router.push("/dashboard/submissions");
  };

  return (
    <>
      <div className="hidden items-center gap-2 sm:flex">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="font-label text-xs uppercase tracking-wider"
          disabled={isSubmitting}
          onClick={onSaveDraft}
          data-testid="wizard-save-draft"
        >
          Save draft
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-label text-xs uppercase tracking-wider"
          disabled={isSubmitting}
          onClick={onSaveAndLeave}
          data-testid="wizard-save-and-leave"
        >
          Save & exit
        </Button>
      </div>

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen}>
        <BottomSheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 sm:hidden"
            aria-label="Submission actions"
            data-testid="wizard-actions-menu"
          >
            <MoreVertical className="size-5" aria-hidden />
          </Button>
        </BottomSheetTrigger>
        <BottomSheetContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <BottomSheetHeader>
            <BottomSheetTitle className="font-headline text-left text-lg">
              Submission
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
                  onSaveAndLeave();
                }}
                data-testid="wizard-save-and-leave-mobile"
              >
                Save & exit
              </Button>
            </li>
            <li>
              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full justify-start font-body text-base"
                disabled={isSubmitting}
                onClick={() => {
                  setMenuOpen(false);
                  onSaveDraft();
                }}
                data-testid="wizard-save-draft-mobile"
              >
                Save draft
              </Button>
            </li>
            <li>
              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full justify-start font-body text-base text-on-surface-variant"
                disabled={isSubmitting}
                onClick={exitWithoutSaving}
                data-testid="wizard-exit-without-saving"
              >
                Exit without saving
              </Button>
            </li>
          </ul>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
