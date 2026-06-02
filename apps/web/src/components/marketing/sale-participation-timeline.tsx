"use client";

import {
  type OnlineRegistrationStatus,
  getOnlineRegisterStepDescription,
  getOnlineTimelineStep2Description,
  getOnlineTimelineStep3Description,
  getOnlineTimelineStepTitle,
  getOnsiteAbsenteePhoneStepDescription,
  getOnsitePaddleStepDescription,
  getOnsitePreviewStepDescription,
  getOnsiteStreamStepDescription,
  getOnsiteTimelineStepTitle,
} from "@/lib/sale-participation-steps";
import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ArrowRight, Check, Clock, Lock, ShieldAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";

type RegistrationItem = {
  buyerLegalEntityId: string;
  status: string;
};

type EntityItem = {
  id: string;
  displayName: string;
  memberRole: string;
};

type Props = {
  deliveryMode: "online" | "onsite";
  isAuthenticated?: boolean;
  kycApproved?: boolean;
  myRegistrations?: RegistrationItem[];
  buyerEntities?: EntityItem[];
  previewStartTime?: Date | string | null;
  startTime: Date | string;
  endTime: Date | string;
  streamUrl?: string | null;
  /** When set, step 3 absentee CTA links to `#${absenteeAnchorId}` instead of `#plan-visit`. */
  absenteeAnchorId?: string;
  /** When set, step 4 stream CTA links in-page instead of opening streamUrl externally. */
  liveStreamAnchorId?: string;
  className?: string;
};

export function SaleParticipationTimeline({
  deliveryMode,
  isAuthenticated = false,
  kycApproved = false,
  myRegistrations = [],
  buyerEntities = [],
  previewStartTime,
  startTime,
  endTime,
  streamUrl,
  absenteeAnchorId,
  liveStreamAnchorId,
  className,
}: Props) {
  const pres = getSaleTypePresentation(deliveryMode);
  const now = React.useMemo(() => new Date(), []);
  const start = React.useMemo(() => new Date(startTime), [startTime]);
  const end = React.useMemo(() => new Date(endTime), [endTime]);
  const previewStart = React.useMemo(
    () => (previewStartTime ? new Date(previewStartTime) : null),
    [previewStartTime],
  );

  const hasLiveStream = Boolean(streamUrl);
  const isSaleActive = now >= start && now < end;
  const isSaleEnded = now >= end;

  const registrationStatus = React.useMemo((): OnlineRegistrationStatus => {
    if (!isAuthenticated) return "unauthenticated";
    if (!kycApproved) return "needs_kyc";
    if (buyerEntities.length === 0) return "needs_entity";
    if (myRegistrations.length === 0) return "not_registered";

    const statuses = myRegistrations.map((r) => r.status);
    if (statuses.includes("approved")) return "approved";
    if (statuses.includes("pending")) return "pending";
    return "rejected";
  }, [isAuthenticated, kycApproved, buyerEntities, myRegistrations]);

  const steps = React.useMemo(() => {
    if (deliveryMode === "online") {
      const step1 = {
        title: getOnlineTimelineStepTitle(1),
        description: getOnlineRegisterStepDescription(registrationStatus),
        status: "pending" as "pending" | "completed" | "active" | "error",
        action: null as React.ReactNode,
      };

      if (registrationStatus === "unauthenticated") {
        step1.status = "pending";
        step1.action = (
          <Button size="sm" variant="outline" className="mt-2" asChild>
            <Link href="/login">
              Sign in <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        );
      } else if (registrationStatus === "needs_kyc") {
        step1.status = "active";
        step1.action = (
          <Button size="sm" variant="outline" className="mt-2" asChild>
            <Link href="/dashboard/verify-identity">
              Verify Identity <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        );
      } else if (registrationStatus === "needs_entity") {
        step1.status = "active";
        step1.action = (
          <Button size="sm" variant="outline" className="mt-2" asChild>
            <Link href="/onboarding/organisation">
              Create Profile <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        );
      } else if (registrationStatus === "not_registered") {
        step1.status = "active";
        step1.action = (
          <Button size="sm" variant="outline" className="mt-2" asChild>
            <Link href="#catalog">
              Register to Bid <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        );
      } else if (registrationStatus === "pending") {
        step1.status = "active";
      } else if (registrationStatus === "rejected") {
        step1.status = "error";
      } else {
        step1.status = "completed";
      }

      const step2 = {
        title: getOnlineTimelineStepTitle(2),
        description: getOnlineTimelineStep2Description(),
        status: isSaleEnded
          ? ("completed" as const)
          : registrationStatus === "approved"
            ? ("active" as const)
            : ("pending" as const),
        action:
          registrationStatus === "approved" && !isSaleEnded ? (
            <Button size="sm" variant="outline" className="mt-2" asChild>
              <Link href="#catalog">Explore Lots</Link>
            </Button>
          ) : null,
      };

      const step3 = {
        title: getOnlineTimelineStepTitle(3),
        description: getOnlineTimelineStep3Description(isSaleEnded, end),
        status: isSaleEnded
          ? ("completed" as const)
          : isSaleActive
            ? ("active" as const)
            : ("pending" as const),
        action: null,
      };

      return [step1, step2, step3];
    }

    const step1 = {
      title: getOnsiteTimelineStepTitle(1),
      description: getOnsitePreviewStepDescription(previewStart),
      status: now >= (previewStart || start) ? ("completed" as const) : ("active" as const),
      action: null,
    };

    const step2 = {
      title: getOnsiteTimelineStepTitle(2),
      description: getOnsitePaddleStepDescription(),
      status: isSaleEnded
        ? ("completed" as const)
        : isSaleActive
          ? ("active" as const)
          : ("pending" as const),
      action: !isSaleEnded ? (
        <Button size="sm" variant="outline" className="mt-2" asChild>
          <Link href="#plan-visit">Plan Visit</Link>
        </Button>
      ) : null,
    };

    const step3 = {
      title: getOnsiteTimelineStepTitle(3),
      description: getOnsiteAbsenteePhoneStepDescription(),
      status: isSaleEnded
        ? ("completed" as const)
        : isSaleActive
          ? ("pending" as const)
          : ("active" as const),
      action:
        !isSaleActive && !isSaleEnded ? (
          <Button size="sm" variant="outline" className="mt-2" asChild>
            <Link href={absenteeAnchorId ? `#${absenteeAnchorId}` : "#plan-visit"}>
              Submit Absentee Bids
            </Link>
          </Button>
        ) : null,
    };

    const step4 = {
      title: getOnsiteTimelineStepTitle(4),
      description: getOnsiteStreamStepDescription(hasLiveStream),
      status: isSaleEnded
        ? ("completed" as const)
        : isSaleActive
          ? ("active" as const)
          : ("pending" as const),
      action:
        hasLiveStream && !isSaleEnded && (liveStreamAnchorId || streamUrl) ? (
          <Button size="sm" className="mt-2 gap-1.5" asChild>
            {liveStreamAnchorId ? (
              <Link href={`#${liveStreamAnchorId}`}>
                <span className="live-dot-pulse size-1.5 rounded-full bg-live-red inline-block" />
                Watch Live Stream
              </Link>
            ) : streamUrl ? (
              <a href={streamUrl} target="_blank" rel="noopener noreferrer">
                <span className="live-dot-pulse size-1.5 rounded-full bg-live-red inline-block" />
                Watch Live Stream
              </a>
            ) : null}
          </Button>
        ) : null,
    };

    return [step1, step2, step3, step4];
  }, [
    deliveryMode,
    registrationStatus,
    previewStart,
    start,
    end,
    now,
    isSaleActive,
    isSaleEnded,
    hasLiveStream,
    streamUrl,
    absenteeAnchorId,
    liveStreamAnchorId,
  ]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-1.5">
        <h3 className="font-headline text-lg font-semibold text-on-surface">{pres.title} Guide</h3>
        <p className="font-body text-xs text-on-surface-variant leading-relaxed">
          {pres.description}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 md:gap-4">
        {steps.map((step) => {
          const isCompleted = step.status === "completed";
          const isActive = step.status === "active";
          const isError = step.status === "error";

          return (
            <div
              key={step.title}
              className={cn(
                "relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-300",
                isCompleted
                  ? "border-emerald-500/20 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]"
                  : isActive
                    ? "border-primary bg-primary/[0.01] dark:bg-primary/[0.01] shadow-xs"
                    : isError
                      ? "border-destructive/30 bg-destructive/[0.02]"
                      : "border-outline-variant/30 bg-surface-container-lowest/50 dark:bg-surface-container-low/30 opacity-70",
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "font-label text-[10px] font-bold uppercase tracking-wider",
                      isCompleted
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isActive
                          ? "text-primary"
                          : isError
                            ? "text-destructive"
                            : "text-on-surface-variant/60",
                    )}
                  >
                    {isCompleted
                      ? "Completed"
                      : isActive
                        ? "Current Step"
                        : isError
                          ? "Action Required"
                          : "Upcoming"}
                  </span>
                  <div
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border",
                      isCompleted
                        ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : isError
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "border-outline-variant bg-transparent text-on-surface-variant/40",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="size-3" />
                    ) : isError ? (
                      <ShieldAlert className="size-3" />
                    ) : isActive ? (
                      <Clock className="size-3 animate-pulse" />
                    ) : (
                      <Lock className="size-2.5" />
                    )}
                  </div>
                </div>

                <h4
                  className={cn(
                    "font-headline text-sm font-semibold leading-snug",
                    isCompleted
                      ? "text-on-surface/80"
                      : isActive
                        ? "text-on-surface"
                        : "text-on-surface/60",
                  )}
                >
                  {step.title}
                </h4>
                <p className="font-body text-xs text-on-surface-variant leading-relaxed">
                  {step.description}
                </p>
              </div>

              {step.action ? (
                <div className="mt-4 pt-2 border-t border-outline-variant/10">{step.action}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
