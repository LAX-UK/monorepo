"use client";

import { kycLinkActionLabel } from "@/components/kyc/kyc-copy";
import { useOverlayTone, useOverlayToneContext } from "@/components/ui/overlay-tone-context";
import { OverlayToneText } from "@/components/ui/overlay-tone-text";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { registerForSale } from "@/lib/data/http/sale-registration.client";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import {
  BID_LIMIT_FIELD_LABEL,
  bidLimitFieldHelp,
  bidLimitFieldPlaceholder,
} from "@/lib/saleroom/bid-limit-field-copy";
import {
  overlayOutlineButtonClasses,
  overlayToneProps,
  saleroomHeroActionSizing,
} from "@/lib/ui/overlay-tone-classes";
import type { LegalEntityMemberRole } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";

type Entity = { id: string; displayName: string; memberRole: LegalEntityMemberRole };

export type SaleroomRegisterToBidLayout = "default" | "button" | "form";

type RegisterToBidBaseProps = {
  saleId: string;
  loginNextPath: string;
  isAuthenticated: boolean;
  show: boolean;
  buyerEntities: Entity[];
  myRegistrations: {
    buyerLegalEntityId: string;
    status: string;
    bidLimit?: string | null;
    paddleNumber?: number | null;
    checkedInAt?: string | null;
  }[];
  kycApproved: boolean;
  kycFeedback?: KycUserFeedbackDto | null;
  orgModuleEnabled?: boolean;
  saleCurrency?: string;
};

type Props = RegisterToBidBaseProps & {
  layout?: SaleroomRegisterToBidLayout;
};

function agentEntitiesFrom(buyerEntities: Entity[]) {
  return buyerEntities.filter((e) => e.memberRole === "buyer_agent");
}

/** Hero band 2 caption when KYC blocks bidding. */
export function registerToBidHeroCaption({
  show,
  isAuthenticated,
  kycApproved,
  kycFeedback = null,
}: Pick<RegisterToBidBaseProps, "show" | "isAuthenticated" | "kycApproved" | "kycFeedback">):
  | string
  | null {
  if (!show || !isAuthenticated || kycApproved) return null;
  return kycFeedback?.detail ?? null;
}

/** Whether the agent registration form should render in hero band 3. */
export function registerToBidNeedsAgentFormBand({
  show,
  isAuthenticated,
  kycApproved,
  buyerEntities,
}: Pick<
  RegisterToBidBaseProps,
  "show" | "isAuthenticated" | "kycApproved" | "buyerEntities"
>): boolean {
  if (!show || !isAuthenticated || !kycApproved) return false;
  if (buyerEntities.length === 0) return false;
  return agentEntitiesFrom(buyerEntities).length > 0;
}

export function RegisterHelperText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const inFrame = useOverlayToneContext() != null;
  if (inFrame) {
    return (
      <OverlayToneText
        variant="muted"
        className={cn("max-w-sm font-body text-xs text-pretty", className)}
      >
        {children}
      </OverlayToneText>
    );
  }
  return (
    <p className={cn("max-w-sm font-body text-xs text-on-surface-variant text-pretty", className)}>
      {children}
    </p>
  );
}

function RegisterOutlineLink({ href, children }: { href: string; children: ReactNode }) {
  const inFrame = useOverlayToneContext() != null;
  const overlayTone = useOverlayTone("contentBlock");
  if (inFrame) {
    return (
      <Link
        href={href}
        className={cn(
          overlayOutlineButtonClasses(
            overlayTone,
            cn(saleroomHeroActionSizing, "shrink-0 justify-center"),
          ),
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand",
        )}
        {...overlayToneProps(overlayTone)}
      >
        {children}
      </Link>
    );
  }
  return (
    <Button
      asChild
      variant="outline"
      size="md"
      className={cn(saleroomHeroActionSizing, "shrink-0")}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function AgentRegistrationForm({
  saleId,
  saleCurrency,
  agentEntities,
  myRegistrations,
  statusByLe,
}: {
  saleId: string;
  saleCurrency: string;
  agentEntities: Entity[];
  myRegistrations: RegisterToBidBaseProps["myRegistrations"];
  statusByLe: Map<string, string>;
}) {
  const router = useRouter();
  const [entityId, setEntityId] = useState("");
  const [bidLimit, setBidLimit] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedStatus = entityId ? statusByLe.get(entityId) : undefined;

  function onEntityChange(id: string) {
    setEntityId(id);
    const reg = myRegistrations.find((r) => r.buyerLegalEntityId === id);
    setBidLimit(reg?.bidLimit?.replace(/\.00$/, "") ?? "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!entityId) {
      setError("Choose the legal entity you are bidding as.");
      return;
    }
    setLoading(true);
    try {
      const body: { buyerLegalEntityId: string; bidLimit?: number } = {
        buyerLegalEntityId: entityId,
      };
      const n = Number.parseFloat(bidLimit);
      if (bidLimit.trim() !== "" && Number.isFinite(n) && n > 0) {
        body.bidLimit = n;
      }
      const result = await registerForSale(saleId, body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        selectedStatus === "pending" || selectedStatus === "approved"
          ? "Registration updated."
          : "Registration submitted. Our team will review it shortly.",
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex w-full min-w-0 max-w-md flex-col gap-2 rounded-md border border-outline-variant/30 bg-surface-container-low/40 p-3 sm:max-w-sm"
    >
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Register to bid (buyer agents)
      </p>
      <p className="font-body text-xs text-on-surface-variant">
        For organisations bidding as agents on this sale. Private collectors can bid online after
        sign-in and identity verification — no separate registration.
      </p>
      <div className="space-y-1">
        <Label htmlFor={`register-entity-${saleId}`} className="font-body text-xs text-secondary">
          Buying as
        </Label>
        <Select value={entityId} onValueChange={onEntityChange} required>
          <SelectTrigger
            id={`register-entity-${saleId}`}
            className="w-full font-body text-sm"
            aria-required="true"
          >
            <SelectValue placeholder="Select legal entity…" />
          </SelectTrigger>
          <SelectContent>
            {agentEntities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {entityId && selectedStatus ? (
        <p className="font-body text-xs text-secondary">
          Status for this sale:{" "}
          <span className="font-medium text-on-surface">{selectedStatus}</span>
        </p>
      ) : null}
      <div className="space-y-1">
        <Label
          htmlFor={`register-bid-limit-${saleId}`}
          className="font-body text-xs text-secondary"
        >
          {BID_LIMIT_FIELD_LABEL}
        </Label>
        <Input
          id={`register-bid-limit-${saleId}`}
          type="number"
          min={0}
          step="0.01"
          className="font-body text-sm"
          value={bidLimit}
          onChange={(ev) => setBidLimit(ev.target.value)}
          placeholder={bidLimitFieldPlaceholder(saleCurrency)}
        />
        <p className="font-body text-xs text-on-surface-variant">
          {bidLimitFieldHelp(saleCurrency)}
        </p>
      </div>
      {error ? <p className="font-body text-xs text-destructive">{error}</p> : null}
      {message ? <p className="font-body text-xs text-primary">{message}</p> : null}
      <Button type="submit" disabled={loading} className="min-h-11 w-full sm:w-auto" size="sm">
        {loading ? "Submitting…" : "Submit registration"}
      </Button>
    </form>
  );
}

export function SaleroomRegisterToBid({
  saleId,
  loginNextPath,
  isAuthenticated,
  show,
  buyerEntities,
  myRegistrations,
  kycApproved,
  kycFeedback = null,
  orgModuleEnabled = true,
  saleCurrency = "GBP",
  layout = "default",
}: Props) {
  const statusByLe = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of myRegistrations) {
      m.set(r.buyerLegalEntityId, r.status);
    }
    return m;
  }, [myRegistrations]);

  const agentEntities = useMemo(() => agentEntitiesFrom(buyerEntities), [buyerEntities]);

  const registerProps: RegisterToBidBaseProps = {
    saleId,
    loginNextPath,
    isAuthenticated,
    show,
    buyerEntities,
    myRegistrations,
    kycApproved,
    kycFeedback,
    orgModuleEnabled,
    saleCurrency,
  };

  if (!show) return null;

  if (layout === "form") {
    if (!registerToBidNeedsAgentFormBand(registerProps)) return null;
    return (
      <AgentRegistrationForm
        saleId={saleId}
        saleCurrency={saleCurrency}
        agentEntities={agentEntities}
        myRegistrations={myRegistrations}
        statusByLe={statusByLe}
      />
    );
  }

  if (layout === "button") {
    if (!isAuthenticated) {
      return (
        <RegisterOutlineLink href={`/login?next=${encodeURIComponent(loginNextPath)}`}>
          Register to bid
        </RegisterOutlineLink>
      );
    }

    if (!kycApproved) {
      const verifyHref = contextualIdentityOnboardingHref(loginNextPath, "registration");
      const verifyLabel = kycFeedback
        ? kycLinkActionLabel(kycFeedback, "long")
        : "Verify identity to bid";
      return <RegisterOutlineLink href={verifyHref}>{verifyLabel}</RegisterOutlineLink>;
    }

    if (buyerEntities.length === 0) {
      if (!orgModuleEnabled) return null;
      return (
        <RegisterOutlineLink href="/onboarding/organisation">
          Set up a buyer profile
        </RegisterOutlineLink>
      );
    }

    if (agentEntities.length === 0) return null;

    return <RegisterOutlineLink href="#register-to-bid">Register to bid →</RegisterOutlineLink>;
  }

  // layout === "default"
  if (!isAuthenticated) {
    return (
      <RegisterOutlineLink href={`/login?next=${encodeURIComponent(loginNextPath)}`}>
        Register to bid
      </RegisterOutlineLink>
    );
  }

  if (!kycApproved) {
    const verifyHref = contextualIdentityOnboardingHref(loginNextPath, "registration");
    const verifyLabel = kycFeedback
      ? kycLinkActionLabel(kycFeedback, "long")
      : "Verify identity to bid";

    return (
      <div className="flex min-w-0 max-w-md flex-col gap-2 sm:max-w-sm">
        {kycFeedback?.detail ? <RegisterHelperText>{kycFeedback.detail}</RegisterHelperText> : null}
        <RegisterOutlineLink href={verifyHref}>{verifyLabel}</RegisterOutlineLink>
      </div>
    );
  }

  if (buyerEntities.length === 0) {
    if (!orgModuleEnabled) {
      return <RegisterHelperText>Organisation buyer profiles are coming soon.</RegisterHelperText>;
    }
    return (
      <RegisterOutlineLink href="/onboarding/organisation">
        Set up a buyer profile
      </RegisterOutlineLink>
    );
  }

  const assignedPaddle = myRegistrations.find(
    (registration) => registration.status === "approved" && registration.paddleNumber != null,
  )?.paddleNumber;

  if (assignedPaddle != null) {
    return (
      <RegisterHelperText>
        Your in-room paddle:{" "}
        <strong className="font-headline tabular-nums text-on-surface">{assignedPaddle}</strong>
      </RegisterHelperText>
    );
  }

  if (agentEntities.length === 0) {
    if (!orgModuleEnabled) {
      return (
        <RegisterHelperText>
          Bidding on this sale needs a buyer-agent profile. Organisation buyer profiles are coming
          soon.
        </RegisterHelperText>
      );
    }
    return (
      <RegisterHelperText>
        Bidding online? Sign in and verify your identity — no extra registration needed for private
        collectors. Buyer agents can{" "}
        <Link href="/onboarding/organisation" className="text-link underline">
          set up an organisation profile
        </Link>{" "}
        to register here.
      </RegisterHelperText>
    );
  }

  return (
    <AgentRegistrationForm
      saleId={saleId}
      saleCurrency={saleCurrency}
      agentEntities={agentEntities}
      myRegistrations={myRegistrations}
      statusByLe={statusByLe}
    />
  );
}
