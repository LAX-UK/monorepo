/** Maps API invitation errors to copy for the person accepting. */
export function describeStaffInvitationError(apiError: string | null): string {
  switch (apiError) {
    case "Email does not match invitation":
      return "This invitation was sent to a different email address. Sign in with that address to accept it.";
    case "Invitation expired":
      return "This invitation has expired. Ask the person who invited you to send a new one.";
    case "Invalid invitation":
      return "This invitation is no longer valid. It may have been accepted or withdrawn.";
    default:
      return "We couldn't accept this invitation. Try again in a moment.";
  }
}
