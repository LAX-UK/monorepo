import {
  AccountShell,
  Card,
  Row,
  StatusPill,
  secondaryButton,
  textLink,
} from "@/components/account-ui";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import { buildAccountLinks } from "@/server/domain/account-links";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function SignOutButton() {
  return (
    <form method="post" action="/api/auth/logout">
      <button type="submit" className={textLink}>
        Sign out
      </button>
    </form>
  );
}

export default async function AccountPage() {
  const session = await loadAccountSession();
  if (session.status !== "ok") redirect("/api/auth/login?returnTo=/account");
  const { overview } = session;
  const links = buildAccountLinks(getLaxAccountContainer().config, { email: overview.email });
  const editProfile = links.editProfile ? (
    <a href={links.editProfile} className={textLink}>
      Edit in LAX Bid
    </a>
  ) : null;

  return (
    <AccountShell actions={<SignOutButton />}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Hi, {overview.displayName}</h1>
        <p className="text-sm text-on-surface-variant">
          These details are shared by LAX Bid, LAX Shop and every product you sign in to with this
          account.
        </p>
      </div>

      <Card id="profile" title="Profile">
        <dl>
          <Row label="Name" action={editProfile}>
            {overview.name ?? <span className="text-on-surface-variant">Not added</span>}
          </Row>
          <Row
            label="Email"
            action={
              overview.email && !overview.emailVerified ? (
                <a href={links.verifyEmail} className={secondaryButton}>
                  Verify email
                </a>
              ) : null
            }
          >
            {overview.email ?? <span className="text-on-surface-variant">Not added</span>}
            {overview.email ? (
              <StatusPill tone={overview.emailVerified ? "ok" : "muted"}>
                {overview.emailVerified ? "Verified" : "Not verified"}
              </StatusPill>
            ) : null}
          </Row>
          <Row label="Mobile number">
            {overview.phone ?? <span className="text-on-surface-variant">Not added</span>}
            {overview.phone ? (
              <StatusPill tone={overview.phoneVerified ? "ok" : "muted"}>
                {overview.phoneVerified ? "Verified" : "Not verified"}
              </StatusPill>
            ) : null}
          </Row>
        </dl>
      </Card>

      <Card
        id="security"
        title="Security"
        description="Keep your account protected on every LAX product."
      >
        <dl>
          <Row
            label="Password"
            action={
              <a href={links.changePassword} className={secondaryButton}>
                Change password
              </a>
            }
          >
            We'll email you a secure link. Changing it signs you out on your other devices.
          </Row>
          <Row
            label="Two-step verification"
            action={
              <a href={links.manageTwoStep} className={secondaryButton}>
                {overview.signedInWithAuthenticator ? "Manage" : "Set up or manage"}
              </a>
            }
          >
            {overview.signedInWithAuthenticator ? (
              <>
                On
                <StatusPill tone="ok">Used for this sign-in</StatusPill>
                <span className="mt-1 block text-on-surface-variant">
                  Lost your authenticator? Contact LAX support to reset it.
                </span>
              </>
            ) : (
              <span className="text-on-surface-variant">
                Add an authenticator app so signing in needs a code as well as your password. If you
                already have one, you can manage or turn it off there — unless your organisation or
                LAX requires it.
              </span>
            )}
          </Row>
        </dl>
      </Card>
    </AccountShell>
  );
}
