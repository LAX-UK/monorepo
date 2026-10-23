import type { AccountEmailChangeConfirmedResponse } from "@auction/identity-contracts/account";

// Imported by the client confirm page, so it uses the browser-safe account entry of the identity
// contracts; the package root also exports server-only crypto.

export type EmailChangeConfirmationVm = {
  heading: string;
  body: string;
  /** True once the address has switched: every sign-in was ended, so the person must sign in again. */
  signInAgain: boolean;
};

/** What the page behind an emailed confirmation link tells the person after they confirm. */
export function buildEmailChangeConfirmationVm(
  result: AccountEmailChangeConfirmedResponse,
): EmailChangeConfirmationVm {
  if (result.completed) {
    return {
      heading: "Your email address has changed",
      body: "Both addresses are confirmed. For your security we've signed you out of LAX everywhere. Sign in again with your new email address.",
      signInAgain: true,
    };
  }
  const other = result.confirmedFor === "old" ? "your new address" : "your current address";
  return {
    heading: "One more step",
    body: `Thank you, this address is confirmed. Open the email we sent to ${other} and confirm there to finish the change.`,
    signInAgain: false,
  };
}
