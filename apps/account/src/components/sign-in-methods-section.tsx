import { Button } from "@/components/account-button";
import {
  AccountSection,
  ListCard,
  ListCardRow,
  NOTICE,
  NoticeTitle,
} from "@/components/account-ui";
import type { SettingsRowVm } from "@/server/domain/account-settings.vm";
import type {
  SignInMethodFlashVm,
  SignInMethodsSectionVm,
} from "@/server/domain/account-sign-in-methods.vm";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import type { ReactNode } from "react";
import { SignInMethodFlash } from "./sign-in-method-flash.client";
import { SignInMethodsList } from "./sign-in-methods-list.client";

type SignInMethodsSectionProps = {
  section: SignInMethodsSectionVm;
  /** The page this section sits on: where to return after signing in again, and where to retry. */
  pagePath: string;
  reauthHref: string;
  /** The password form, which the Password row opens in place. */
  passwordPanel: ReactNode;
  twoStep: SettingsRowVm;
  /** What happened when the issuer sent the person back from Google or Apple, if it did. */
  flash?: SignInMethodFlashVm | null;
};

/** Why the list of methods cannot be shown, in plain words, with the way forward. */
function SignInMethodsNotice({
  section,
  pagePath,
  reauthHref,
}: {
  section: Exclude<SignInMethodsSectionVm, { status: "list" }>;
  pagePath: string;
  reauthHref: string;
}) {
  return section.status === "reauth_required" ? (
    <Alert variant="warning" className={NOTICE}>
      <NoticeTitle level={3}>Sign in again to see your sign-in methods</NoticeTitle>
      <AlertDescription>
        Your sign-in has ended, so we can't list the ways you sign in.
      </AlertDescription>
      <Button asChild variant="cta" className="mt-4 min-h-11">
        <a href={reauthHref}>Sign in again</a>
      </Button>
    </Alert>
  ) : (
    <Alert variant="destructive" className={NOTICE}>
      <NoticeTitle level={3}>We can't show your sign-in methods right now</NoticeTitle>
      <AlertDescription>
        This is a temporary problem on our side and nothing has changed.
      </AlertDescription>
      <Button asChild variant="outline" className="mt-4 min-h-11">
        <a href={pagePath}>Try again</a>
      </Button>
    </Alert>
  );
}

/**
 * "How you sign in": password (its form opens in place), any linked Google or Apple account and
 * two-step verification. When the list cannot be read, the reason shows and the password form and
 * two-step verification stay available, as they do not depend on it.
 */
export function SignInMethodsSection({
  section,
  pagePath,
  reauthHref,
  passwordPanel,
  twoStep,
  flash = null,
}: SignInMethodsSectionProps) {
  return (
    <AccountSection
      id="sign-in-methods"
      title="How you sign in"
      description="The ways you can sign in to LAX. Keep at least one you can always use."
    >
      {flash ? (
        <SignInMethodFlash flash={flash} pagePath={pagePath} reauthHref={reauthHref} />
      ) : null}
      {section.status === "list" ? (
        <SignInMethodsList
          rows={section.rows}
          hint={section.hint}
          returnTo={pagePath}
          passwordPanel={passwordPanel}
          twoStep={twoStep}
        />
      ) : (
        <>
          <SignInMethodsNotice section={section} pagePath={pagePath} reauthHref={reauthHref} />
          <h3 className="font-headline text-base font-semibold text-on-surface">Password</h3>
          {passwordPanel}
          <ListCard>
            <ListCardRow
              title={twoStep.title}
              {...(twoStep.subtitle ? { subtitle: twoStep.subtitle } : {})}
              href={twoStep.href}
            />
          </ListCard>
        </>
      )}
    </AccountSection>
  );
}
