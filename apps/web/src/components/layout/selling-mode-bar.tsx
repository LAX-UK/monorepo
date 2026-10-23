"use client";

import { initials } from "@/components/organisations/initials";
import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
import {
  type SellingContextOption,
  sellingContextOptions,
  sellingModeLabel,
} from "@/lib/navigation/selling-mode";
import { switchSellingContext } from "@/lib/navigation/switch-selling-context";
import { notify } from "@/lib/ui/notify";
import { clientWorkspaceHomePath } from "@/lib/workspace/client-workspace-mode";
import type { LegalEntitySummary } from "@auction/types";
import { cn } from "@auction/ui";
import { Avatar, AvatarFallback } from "@auction/ui/components/avatar";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { ArrowLeft, Check, ChevronDown, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  acting: LegalEntitySummary;
  memberships: LegalEntitySummary[];
  orgModuleEnabled: boolean;
  pendingInvitesCount?: number;
};

const ROW_CLASS =
  "flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-ring";

function optionInitials(option: SellingContextOption): string {
  return option.kind === "personal" ? "Me" : initials(option.name);
}

type AccountListProps = {
  options: readonly SellingContextOption[];
  pendingInvitesCount: number;
  onChoose: (option: SellingContextOption) => void;
  onNavigate: () => void;
};

/** The accounts someone can sell as, with the links to register an organisation or answer invitations. */
function AccountList({ options, pendingInvitesCount, onChoose, onNavigate }: AccountListProps) {
  return (
    <>
      <ul className="p-1">
        {options.map((option) => (
          <li key={option.id}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChoose(option)}
              aria-current={option.current ? "true" : undefined}
              className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal px-3 py-2 text-left font-normal"
            >
              <Check
                className={cn(
                  "size-4 shrink-0 text-primary",
                  option.current ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
              <Avatar size="sm">
                <AvatarFallback className="bg-surface-container-high text-xs font-semibold">
                  {optionInitials(option)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium text-on-surface">
                  {option.name}
                </span>
                <span className="block text-xs text-on-surface-variant">{option.detail}</span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <div className="border-t border-border-hairline p-1">
        {pendingInvitesCount > 0 ? (
          <Link href="/dashboard/invitations" onClick={onNavigate} className={ROW_CLASS}>
            Pending invitations ({pendingInvitesCount > 9 ? "9+" : pendingInvitesCount})
          </Link>
        ) : null}
        <Link href="/onboarding/organisation?fresh=1" onClick={onNavigate} className={ROW_CLASS}>
          <Plus className="size-4 text-primary" aria-hidden />
          Register an organisation
        </Link>
      </div>
    </>
  );
}

/**
 * The persistent Selling mode header: what you are selling as, a picker for your organisations,
 * and an always-visible way back to buying.
 *
 * From `sm` up it is a labelled picker beside a "Back to buying" link. On a phone the header has
 * no room for either, so a compact avatar button opens a bottom sheet that holds both: "Back to
 * buying" first, then the accounts. The picker is left out for people with no organisation
 * because there is nothing to choose.
 */
export function SellingModeBar({
  acting,
  memberships,
  orgModuleEnabled,
  pendingInvitesCount = 0,
}: Props) {
  const router = useRouter();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const options = sellingContextOptions({ memberships, actingId: acting.id, orgModuleEnabled });
  const canPick = options.some((o) => o.kind === "organisation");
  const label = sellingModeLabel(acting);
  const current = options.find((o) => o.current);

  async function choose(option: SellingContextOption) {
    setPopoverOpen(false);
    setSheetOpen(false);
    if (option.current) return;
    setPending(true);
    const outcome = await switchSellingContext(option.id, switchActingLegalEntity);
    setPending(false);
    if (outcome.kind === "refused") {
      notify.error(outcome.title, { description: outcome.description });
      return;
    }
    // A new account has a different set of pages, so start from its overview.
    router.push(clientWorkspaceHomePath("selling"));
    router.refresh();
  }

  return (
    <div className="flex min-w-0 items-center gap-2" data-testid="selling-mode-bar">
      <div className="hidden min-w-0 items-center gap-2 sm:flex">
        {canPick ? (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                aria-label={`${label}. Change who you are selling as`}
                className="h-auto min-h-11 min-w-0 max-w-[18rem] justify-between gap-2 px-3 py-2"
                data-testid="selling-mode-label"
              >
                {pending ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
                <span className="min-w-0 truncate font-label text-sm font-semibold">{label}</span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[22rem] p-0">
              <p className="border-b border-border-hairline px-4 py-3 font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                Sell as
              </p>
              <AccountList
                options={options}
                pendingInvitesCount={pendingInvitesCount}
                onChoose={(option) => void choose(option)}
                onNavigate={() => setPopoverOpen(false)}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <span
            className="truncate px-2 font-label text-sm font-semibold text-on-surface"
            data-testid="selling-mode-label"
          >
            {label}
          </span>
        )}
        <Button asChild variant="ghost" size="sm" className="min-h-11 shrink-0 gap-1.5 px-3">
          <Link href={clientWorkspaceHomePath("buying")} data-testid="back-to-buying">
            <ArrowLeft className="size-4" aria-hidden />
            Back to buying
          </Link>
        </Button>
      </div>

      <div className="sm:hidden">
        <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <BottomSheetTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              aria-label={`${label}. Change account`}
              className="h-11 gap-1 px-2"
              data-testid="selling-mode-switcher"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Avatar size="sm">
                  <AvatarFallback className="bg-surface-container-high text-xs font-semibold">
                    {current ? optionInitials(current) : "Me"}
                  </AvatarFallback>
                </Avatar>
              )}
              <ChevronDown className="size-4 opacity-60" aria-hidden />
            </Button>
          </BottomSheetTrigger>
          <BottomSheetContent className="border-outline-variant">
            <BottomSheetHeader className="px-4 pt-2 pb-1 text-left">
              <BottomSheetTitle className="break-words font-headline text-base font-semibold text-on-surface">
                {label}
              </BottomSheetTitle>
            </BottomSheetHeader>
            <div className="overflow-y-auto pb-4">
              <div className="p-1">
                <Link
                  href={clientWorkspaceHomePath("buying")}
                  onClick={() => setSheetOpen(false)}
                  className={ROW_CLASS}
                  data-testid="back-to-buying-mobile"
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Back to buying
                </Link>
              </div>
              {canPick ? (
                <div className="border-t border-border-hairline">
                  <AccountList
                    options={options}
                    pendingInvitesCount={pendingInvitesCount}
                    onChoose={(option) => void choose(option)}
                    onNavigate={() => setSheetOpen(false)}
                  />
                </div>
              ) : null}
            </div>
          </BottomSheetContent>
        </BottomSheet>
      </div>
    </div>
  );
}
