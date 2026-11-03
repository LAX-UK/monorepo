import { Button } from "@/components/account-button";
import { AccountSection, NOTICE, NoticeTitle } from "@/components/account-ui";
import type { SignInMethodsSectionVm } from "@/server/domain/account-sign-in-methods.vm";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { SignInMethodsList } from "./sign-in-methods-list.client";

type SignInMethodsSectionProps = {
  section: SignInMethodsSectionVm;
  /** The page this section sits on: where to return after signing in again, and where to retry. */
  pagePath: string;
  reauthHref: string;
};

/** "Sign-in methods": the list, or a plain-language reason it cannot be shown. */
export function SignInMethodsSection({ section, pagePath, reauthHref }: SignInMethodsSectionProps) {
  return (
    <AccountSection
      id="sign-in-methods"
      title="Sign-in methods"
      description="The ways you can sign in to LAX. Keep at least one you can always use."
    >
      {section.status === "list" ? (
        <SignInMethodsList rows={section.rows} hint={section.hint} returnTo={pagePath} />
      ) : section.status === "reauth_required" ? (
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
      )}
    </AccountSection>
  );
}
