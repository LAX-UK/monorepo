import { AccountShell } from "@/components/account-shell";
import { AccountPageHeader } from "@/components/account-ui";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import { buildAccountLinks } from "@/server/domain/account-links";
import { buildProfileSections } from "@/server/domain/account-profile.vm";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { InsetGroup } from "@auction/ui/components/inset-group";
import { ListRow } from "@auction/ui/components/list-row";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit account · LAX Account" };

/** Edit account (Figma 950:13732). */
export default async function EditAccountPage() {
  const session = await loadAccountSession();
  if (session.status !== "ok") redirect(`/api/auth/login?returnTo=${ACCOUNT_ROUTES.profile}`);
  const { overview } = session;
  const { config } = getLaxAccountContainer();
  const sections = buildProfileSections(
    overview,
    buildAccountLinks(config, { email: overview.email }),
  );

  return (
    <AccountShell>
      <AccountPageHeader title="My account" backHref={ACCOUNT_ROUTES.settings} />
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`${section.id}-heading`} className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-4">
            <h2
              id={`${section.id}-heading`}
              className="font-label text-xs font-semibold tracking-[var(--text-label-caps-tracking)] text-on-surface uppercase"
            >
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
        </section>
      ))}
    </AccountShell>
  );
}
