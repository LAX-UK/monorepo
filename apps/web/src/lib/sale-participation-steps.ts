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
  const attend = getParticipationStepCopy("onsite", "attendLive");
  return (
    attend?.description ??
    "Attend in person at the saleroom desk before start to register your photo ID and receive your physical bidding paddle."
  );
}

export function getOnsiteAbsenteePhoneStepDescription(): string {
  const absentee = getParticipationStepCopy("onsite", "absenteeBid");
  const phone = getParticipationStepCopy("onsite", "phoneLine");
  if (absentee && phone) {
    return `Can't make it? ${absentee.description} ${phone.description}`;
  }
  return "Can't make it? Submit a confidential absentee bid request or a telephone bidding request before your lot opens. Our team handles approved instructions during the live session.";
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
