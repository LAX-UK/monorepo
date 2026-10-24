import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader, AccountSection, ListCard, ListCardRow } from "@/components/account-ui";
import { AccountUnavailable } from "@/components/account-unavailable";
import { AddressBook } from "@/components/address-book.client";
import { EmailChangeEditor } from "@/components/email-change-editor.client";
import { PersonalNameForm } from "@/components/personal-name-form.client";
import { PhoneEditor } from "@/components/phone-editor.client";
import { toAccountViewer } from "@/components/shell/account-viewer";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import { resolveProfileContact } from "@/server/domain/account-contact.vm";
import { buildAccountLinks } from "@/server/domain/account-links";
import { buildProfileSections, maskPendingEmail } from "@/server/domain/account-profile.vm";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import { ACCOUNT_NAME_MAX_LENGTH } from "@auction/identity-contracts";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Personal details · LAX Account" };

/** Personal details: the name form, then email, phone and the address book. */
export default async function PersonalDetailsPage() {
  const session = await loadAccountSession({
    withLiveName: true,
    withLiveContact: true,
    withLiveAddresses: true,
  });
  if (session.status === "unavailable")
    return <AccountUnavailable retryHref={ACCOUNT_ROUTES.profile} />;
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.profile}`);
  const { overview, liveContact, liveAddresses } = session;
  const { config } = getLaxAccountContainer();
  const contact = resolveProfileContact(overview, liveContact);
  const sections = buildProfileSections(
    contact,
    buildAccountLinks(config, { email: contact.email }),
  );

  return (
    <AccountShell viewer={toAccountViewer(overview)}>
      <AccountPageHeader
        title="Personal details"
        description="The name, email, phone number and addresses you use across LAX Bid, LAX Shop and lax.art."
      />
      <AccountSection id="about" title="About me">
        <PersonalNameForm
          initialName={overview.name}
          maxLength={ACCOUNT_NAME_MAX_LENGTH}
          returnTo={ACCOUNT_ROUTES.profile}
        />
      </AccountSection>
      {sections.map((section) => (
        <AccountSection
          key={section.id}
          id={section.id}
          title={section.title}
          actions={
            section.actions.length > 0 ? (
              <div className="flex items-center gap-4">
                {section.actions.map((action) => (
                  <Button
                    key={action.href}
                    asChild
                    variant="link"
                    size="inline"
                    className="min-h-11"
                  >
                    <a href={action.href} aria-label={`${action.label}: ${section.title}`}>
                      {action.label}
                    </a>
                  </Button>
                ))}
              </div>
            ) : undefined
          }
        >
          {section.fields.length > 0 ? (
            <ListCard>
              {section.fields.map((field) => (
                <ListCardRow
                  key={field.label}
                  title={field.label}
                  value={field.value ?? <span className="text-on-surface-variant">Not added</span>}
                  trailing={
                    field.status ? (
                      <DotStatusPill label={field.status.label} tone={field.status.tone} />
                    ) : null
                  }
                />
              ))}
            </ListCard>
          ) : null}
          {section.note ? <p className="text-sm text-on-surface-variant">{section.note}</p> : null}
          {section.id === "email" ? (
            <EmailChangeEditor
              pendingEmailMasked={maskPendingEmail(contact)}
              returnTo={ACCOUNT_ROUTES.profile}
            />
          ) : null}
          {section.id === "phone" ? (
            <PhoneEditor
              phone={contact.phone}
              phoneVerified={contact.phoneVerified}
              returnTo={ACCOUNT_ROUTES.profile}
            />
          ) : null}
        </AccountSection>
      ))}
      <AccountSection
        id="addresses"
        title="Addresses"
        description="Your delivery and billing addresses, shared by LAX Bid, LAX Shop and lax.art."
      >
        {liveAddresses?.status === "ok" ? (
          <AddressBook
            addresses={liveAddresses.value}
            defaultRecipient={overview.name ?? ""}
            returnTo={ACCOUNT_ROUTES.profile}
          />
        ) : (
          <p role="alert" className="text-sm text-error">
            We couldn't load your addresses just now. Please refresh the page to try again.
          </p>
        )}
      </AccountSection>
    </AccountShell>
  );
}
