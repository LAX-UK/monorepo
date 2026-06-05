export function lookupErrorMessage(code: string): string {
  if (code === "rate_limited" || code.startsWith("lookup_failed_429")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (code.startsWith("lookup_failed_")) {
    return "We couldn't verify your email right now. Please try again shortly.";
  }
  return "We couldn't reach the server. Please check your connection and try again.";
}

export function submitErrorMessage(code: string): string {
  if (code === "rate_limited" || code.startsWith("submit_failed_429")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (code === "event_closed") {
    return "RSVPs for this event are now closed.";
  }
  if (code === "not_registered") {
    return "Create a lax.bid account to reserve your spot.";
  }
  if (code === "suspended") {
    return "This invitation is for active lax.bid clients.";
  }
  if (code === "validation_failed" || code === "invalid_segment") {
    return "Please check your RSVP details and try again.";
  }
  if (code.startsWith("submit_failed_5")) {
    return "Our servers are busy. Please try again in a moment.";
  }
  return "We couldn't save your RSVP. Please try again.";
}
