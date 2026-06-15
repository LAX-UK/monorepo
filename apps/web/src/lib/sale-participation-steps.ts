import {
  type OnsiteTimelineStepKey,
  type ParticipationStepKey,
  getOnlineCloseStepDescription,
  getOnsiteTimelineStepTitleText,
  getParticipationStepCopy,
} from "@/lib/sale-type-presentation";

export type OnlineRegistrationStatus =
  | "unauthenticated"
  | "needs_kyc"
  | "needs_entity"
  | "not_registered"
  | "pending"
  | "rejected"
  | "approved";

export function getOnlineRegisterStepDescription(status: OnlineRegistrationStatus): string {
  switch (status) {
    case "unauthenticated":
      return "Create an account or sign in to begin registration.";
    case "needs_kyc":
      return "Complete identity verification to clear secure bidding checks.";
    case "needs_entity":
      return "Set up your legal buyer entity profile to register for the sale.";
    case "not_registered":
      return "Submit your registration request for this specific sale.";
    case "pending":
      return "Your registration request is submitted and under review by our team.";
    case "rejected":
      return "Your registration request was not approved. Please contact support.";
    case "approved":
      return "Approved! Your profile is verified and ready to bid on any lot.";
  }
}

export function getOnlineTimelineStepTitle(stepIndex: 1 | 2 | 3): string {
  const stepKeys: Record<1 | 2 | 3, ParticipationStepKey> = {
    1: "register",
    2: "maxBids",
    3: "lotClose",
  };
  const copy = getParticipationStepCopy("online", stepKeys[stepIndex]);
  return `${stepIndex}. ${copy?.title ?? "Step"}`;
}

export function getOnlineTimelineStep2Description(): string {
  return getParticipationStepCopy("online", "maxBids")?.description ?? "";
}

export function getOnlineTimelineStep3Description(isSaleEnded: boolean, saleEnd: Date): string {
  if (isSaleEnded) return "Auction has concluded.";
  return getOnlineCloseStepDescription(saleEnd);
}

export function getOnsitePreviewStepDescription(previewStart: Date | null): string {
  if (previewStart && Number.isFinite(previewStart.getTime())) {
    return `Inspect catalogue items in-gallery. Preview starts ${previewStart.toLocaleString(
      "en-GB",
      {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      },
    )}.`;
  }
  return "Item viewing is available prior to the auction. Inspect details and verify conditions in person.";
}

export function getOnsitePaddleStepDescription(): string {
  return (
    getParticipationStepCopy("onsite", "attendLive")?.description ??
    "Join us at the physical saleroom. Present your photo ID at the reception desk to register and receive your bidding paddle."
  );
}

export function getHybridOnlineStepDescription(kycApproved: boolean): string {
  if (!kycApproved) {
    return "Sign in and complete identity verification to bid online on this hybrid sale.";
  }
  return "Your identity is verified — you can bid online on lots with no extra sale registration.";
}

export function getHybridInRoomStepDescription(): string {
  return "Attending in person? Visit the saleroom desk for paddle check-in before the live session.";
}

export function getOnsiteAbsenteeStepDescription(): string {
  const absentee = getParticipationStepCopy("onsite", "absenteeBid");
  return (
    absentee?.description ??
    "Submit a confidential absentee bid request before your lot opens. Our team handles approved instructions during the live session."
  );
}

export function getOnsiteTelephoneStepDescription(): string {
  const phone = getParticipationStepCopy("onsite", "phoneLine");
  return (
    phone?.description ??
    "Request a live telephone bidding line from your dashboard profile. A clerk will call you before your lot opens."
  );
}

export function getOnsiteAbsenteePhoneStepDescription(): string {
  return `${getOnsiteAbsenteeStepDescription()} ${getOnsiteTelephoneStepDescription()}`;
}

export function getOnsiteStreamStepDescription(hasLiveStream: boolean): string {
  const stream = getParticipationStepCopy("onsite", "stream");
  if (hasLiveStream) {
    return `${stream?.description ?? "When a live stream is available, watch the saleroom session from your computer or mobile device."} while the auction runs.`;
  }
  return "Track catalogue status from anywhere. A live stream may be added before the session starts.";
}

export function getOnsiteTimelineStepTitle(stepIndex: 1 | 2 | 3 | 4): string {
  const stepKeys: Record<1 | 2 | 3 | 4, OnsiteTimelineStepKey> = {
    1: "preview",
    2: "paddle",
    3: "absenteePhone",
    4: "streamBroadcast",
  };
  return `${stepIndex}. ${getOnsiteTimelineStepTitleText(stepKeys[stepIndex])}`;
}
