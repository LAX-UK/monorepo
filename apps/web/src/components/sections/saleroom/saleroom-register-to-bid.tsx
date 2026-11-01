"use client";

import { kycLinkActionLabel } from "@/components/kyc/kyc-copy";
import { useOverlayTone, useOverlayToneContext } from "@/components/ui/overlay-tone-context";
import { OverlayToneText } from "@/components/ui/overlay-tone-text";
import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
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
import { Button, Field, NativeSelect, Notice, TextInput } from "@auction/ui/lax";
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
  const useFullPageNav = href.startsWith("/api/auth/login");
  if (inFrame) {
    const className = cn(
      overlayOutlineButtonClasses(
        overlayTone,
        cn(saleroomHeroActionSizing, "shrink-0 justify-center"),
      ),
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand",
    );
    if (useFullPageNav) {
      return (
        <a href={href} className={className} {...overlayToneProps(overlayTone)}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={className} {...overlayToneProps(overlayTone)}>
        {children}
      </Link>
    );
  }
  return (
    <Button asChild variant="secondary" className={cn(saleroomHeroActionSizing, "shrink-0")}>
      {useFullPageNav ? <a href={href}>{children}</a> : <Link href={href}>{children}</Link>}
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
      setError("Choose the account you are bidding as.");
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
      <p className="font-label text-xs text-on-surface-variant">Register to bid (buyer agents)</p>
      <p className="font-body text-xs text-on-surface-variant">
        For organisations bidding as agents on this sale. Private collectors can bid online after
        sign-in and identity verification — no separate registration.
      </p>
      <Field label="Buying as" id={`register-entity-${saleId}`}>
        <NativeSelect
          value={entityId}
          onValueChange={onEntityChange}
          required
          options={[
            { value: "", label: "Select an account…" },
            ...agentEntities.map((e) => ({ value: e.id, label: e.displayName })),
          ]}
        />
      </Field>
      {entityId && selectedStatus ? (
        <p className="font-body text-xs text-secondary">
          Status for this sale:{" "}
          <span className="font-medium text-on-surface">{selectedStatus}</span>
        </p>
      ) : null}
      <Field
        label={BID_LIMIT_FIELD_LABEL}
        description={bidLimitFieldHelp(saleCurrency)}
        optional
        id={`register-bid-limit-${saleId}`}
      >
        <TextInput
          type="number"
          min={0}
          step="0.01"
          value={bidLimit}
          onChange={(ev) => setBidLimit(ev.target.value)}
          placeholder={bidLimitFieldPlaceholder(saleCurrency)}
        />
      </Field>
      {error ? (
        <Notice tone="danger" alert title="We couldn't submit your registration">
          {error}
        </Notice>
      ) : null}
      {message ? <Notice tone="success" title={message} /> : null}
      <Button variant="primary" type="submit" disabled={loading} className="w-full sm:w-auto">
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
        <RegisterOutlineLink
          href={buildHostedLoginStartHref({ next: loginNextPath, intent: "signup" })}
        >
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

    return <RegisterOutlineLink href="#register-to-bid">Register to bid</RegisterOutlineLink>;
  }

  // layout === "default"
  if (!isAuthenticated) {
    return (
      <RegisterOutlineLink
        href={buildHostedLoginStartHref({ next: loginNextPath, intent: "signup" })}
      >
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
