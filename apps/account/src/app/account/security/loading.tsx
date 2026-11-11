import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader } from "@/components/account-ui";
import { SignInMethodsSkeleton } from "@/components/sign-in-methods-skeleton";

/** Shown while the Security page reads the person's sign-in methods and devices. */
export default function SecurityLoading() {
  return (
    <AccountShell>
      <AccountPageHeader
        title="Security"
        description="Your sign-in methods, password, two-step verification and devices."
      />
      <SignInMethodsSkeleton />
    </AccountShell>
  );
}
