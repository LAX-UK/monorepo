import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader } from "@/components/account-ui";
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
import { InsetGroup } from "@auction/ui/components/inset-group";
import { ListRow } from "@auction/ui/components/list-row";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Personal details · LAX Account" };

const SECTION_HEADING =
  "font-label text-xs font-semibold tracking-[var(--text-label-caps-tracking)] text-on-surface uppercase";

/** Personal details (Figma 950:13732). */
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
      <AccountPageHeader title="Personal details" backHref={ACCOUNT_ROUTES.overview} />
      <section aria-labelledby="about-heading" className="space-y-2">
        <h2 id="about-heading" className={`px-4 ${SECTION_HEADING}`}>
          About me
        </h2>
        <PersonalNameForm
          initialName={overview.name}
          maxLength={ACCOUNT_NAME_MAX_LENGTH}
          returnTo={ACCOUNT_ROUTES.profile}
        />
      </section>
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`${section.id}-heading`} className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-4">
            <h2 id={`${section.id}-heading`} className={SECTION_HEADING}>
              {section.title}
            </h2>
            <div className="flex items-center gap-4">
              {section.actions.map((action) => (
                <Button key={action.href} asChild variant="link" size="inline">
                  <a href={action.href} aria-label={`${action.label}: ${section.title}`}>
                    {action.label}
                  </a>
                </Button>
              ))}
            </div>
          </div>
          {section.fields.length > 0 ? (
            <InsetGroup>
              {section.fields.map((field) => (
                <ListRow
                  key={field.label}
                  title={field.label}
                  value={
                    <span className="break-all">
                      {field.value ?? <span className="text-on-surface-variant">Not added</span>}
                    </span>
                  }
                  trailing={
                    field.status ? (
                      <DotStatusPill label={field.status.label} tone={field.status.tone} />
                    ) : null
                  }
                />
              ))}
            </InsetGroup>
          ) : null}
          {section.note ? (
            <p className="px-4 text-xs text-on-surface-variant">{section.note}</p>
          ) : null}
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
        </section>
      ))}
      <section aria-labelledby="addresses-heading" className="space-y-2">
        <h2 id="addresses-heading" className={`px-4 ${SECTION_HEADING}`}>
          Addresses
        </h2>
        <p className="px-4 text-xs text-on-surface-variant">
          Your delivery and billing addresses, shared by LAX Bid, LAX Shop and lax.art.
        </p>
        {liveAddresses?.status === "ok" ? (
          <AddressBook
            addresses={liveAddresses.value}
            defaultRecipient={overview.name ?? ""}
            returnTo={ACCOUNT_ROUTES.profile}
          />
        ) : (
          <p role="alert" className="px-4 text-sm text-error">
            We couldn't load your addresses just now. Please refresh the page to try again.
          </p>
        )}
      </section>
    </AccountShell>
  );
}
