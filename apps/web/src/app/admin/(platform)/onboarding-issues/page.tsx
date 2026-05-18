import { AdminListPage } from "@/components/admin/admin-list-page";
import { getAdminOnboardingIssues } from "@/lib/data/http/admin.server";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

export default async function AdminOnboardingIssuesPage() {
  let data: Awaited<ReturnType<typeof getAdminOnboardingIssues>> | null = null;
  let loadError: string | null = null;
  try {
    data = await getAdminOnboardingIssues();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load onboarding queues.";
  }

  return (
    <AdminListPage
      title="Onboarding & verification queues"
      description="Operational queues surfaced on the admin home dashboard (DSE20)."
      errorAlert={loadError ? <p className="text-sm text-destructive">{loadError}</p> : undefined}
      view={
        data ? (
          <div className="space-y-10">
            <section id="entities-pending-review" className="scroll-mt-24 space-y-3">
              <h2 className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Legal entities pending review
              </h2>
              <Surface variant="card">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-on-surface">
                    docs_received · under_review
                  </h3>
                  <p className="font-body text-sm text-on-surface-variant">
                    Open an entity to run lifecycle transitions.
                  </p>
                </div>
                <div>
                  {data.entitiesPendingReview.length === 0 ? (
                    <EmptyState title="Clear" description="No entities in these statuses." />
                  ) : (
                    <ul className="divide-y divide-outline-variant/15">
                      {data.entitiesPendingReview.map((e) => (
                        <li
                          key={e.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2"
                        >
                          <span className="font-medium">{e.displayName}</span>
                          <span className="font-mono text-xs text-on-surface-variant">
                            {e.status}
                          </span>
                          <Link
                            href={`/admin/legal-entities/${e.id}`}
                            className="text-sm font-medium text-primary underline"
                          >
                            Open
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Surface>
            </section>

            <section id="artists-pending" className="scroll-mt-24 space-y-3">
              <h2 className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Artists pending approval
              </h2>
              <Surface variant="card">
                <div className="p-4">
                  {data.artistsPendingApproval.length === 0 ? (
                    <EmptyState title="Clear" description="No pending artists." />
                  ) : (
                    <ul className="divide-y divide-outline-variant/15">
                      {data.artistsPendingApproval.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2"
                        >
                          <span className="font-medium">{a.displayName}</span>
                          <Link
                            href={`/admin/artists/${a.id}/edit`}
                            className="text-sm font-medium text-primary underline"
                          >
                            Review
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Surface>
            </section>

            <section id="stale-identity" className="scroll-mt-24 space-y-3">
              <h2 className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Stale Stripe Identity sessions (&gt; 48h, not verified)
              </h2>
              <Surface variant="card">
                <div className="p-4">
                  {data.staleIdentitySessions.length === 0 ? (
                    <EmptyState title="Clear" description="No stale verification sessions." />
                  ) : (
                    <ul className="divide-y divide-outline-variant/15">
                      {data.staleIdentitySessions.map((k) => (
                        <li
                          key={k.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2"
                        >
                          <span className="font-mono text-xs">{k.userId}</span>
                          <span className="text-xs text-on-surface-variant">{k.status}</span>
                          <span className="text-xs text-on-surface-variant">
                            {new Date(k.createdAt).toLocaleString("en-GB")}
                          </span>
                          <Link
                            href={`/admin/clients/${encodeURIComponent(k.userId)}`}
                            className="text-sm font-medium text-primary underline"
                          >
                            User
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Surface>
            </section>

            <section id="stale-lead-orgs" className="scroll-mt-24 space-y-3">
              <h2 className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Organisations stuck in lead (&gt; 7 days)
              </h2>
              <Surface variant="card">
                <div className="p-4">
                  {data.staleLeadOrganisations.length === 0 ? (
                    <EmptyState title="Clear" description="No stale lead organisations." />
                  ) : (
                    <ul className="divide-y divide-outline-variant/15">
                      {data.staleLeadOrganisations.map((o) => (
                        <li
                          key={o.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2"
                        >
                          <span className="font-medium">{o.displayName}</span>
                          <span className="text-xs text-on-surface-variant">
                            Created {new Date(o.createdAt).toLocaleDateString("en-GB")}
                          </span>
                          <Link
                            href={`/admin/legal-entities/${o.id}`}
                            className="text-sm font-medium text-primary underline"
                          >
                            Open entity
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Surface>
            </section>

            <section id="documents-awaiting" className="scroll-mt-24 space-y-3">
              <h2 className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Legal entity documents awaiting review
              </h2>
              <Surface variant="card">
                <div className="p-4">
                  {data.documentsAwaitingReview.length === 0 ? (
                    <EmptyState title="Clear" description="No pending entity documents." />
                  ) : (
                    <ul className="divide-y divide-outline-variant/15">
                      {data.documentsAwaitingReview.map((d) => (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2"
                        >
                          <span className="font-medium">{d.entityDisplayName}</span>
                          <span className="font-mono text-xs text-on-surface-variant">
                            {d.uploadObjectId}
                          </span>
                          <Link
                            href={`/admin/legal-entities/${d.legalEntityId}`}
                            className="text-sm font-medium text-primary underline"
                          >
                            Entity
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Surface>
            </section>
          </div>
        ) : null
      }
    />
  );
}
