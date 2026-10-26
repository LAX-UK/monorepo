"use client";

import {
  ArtistArchiveDialog,
  type ArtistArchiveTarget,
} from "@/components/artists/artist-archive-dialog.client";
import { useAdminAction } from "@/components/use-admin-action.client";
import {
  SEO_FIELD_ERRORS,
  type SeoFieldsFormValues,
  seoFieldsFormValues,
} from "@/lib/seo-fields-form";
import {
  linkArtistIdentity,
  unlinkArtistIdentity,
  updateArtistSeo,
} from "@/server/application/admin-people-actions.server";
import {
  ARTIST_LIST_PATH,
  artistArtworksHref,
  artworkCountLabel,
} from "@/server/domain/artist-list.vm";
import { presentStatus } from "@/server/domain/staff-status";
import {
  type AdminArtistDetail,
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
} from "@auction/shop-contracts";
import {
  ConfirmActionDialog,
  type DataColumn,
  DataTable,
  DetailPage,
  EmptyState,
  Field,
  FormActions,
  FormErrorSummary,
  KeyValueList,
  MappedStatusBadge,
  MetaItem,
  OverflowMenu,
  PersonCell,
  PrimaryCell,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StaffMoney,
  TextArea,
  TextInput,
  UnsavedChangesDialog,
  formatStaffDateTime,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { Archive, ArchiveRestore, Images, Link2Off, Plus } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useState } from "react";

const NextLink: StaffLinkComponent = Link;

const presentArtistStatus = presentStatus("artist");
const presentArtworkStatus = presentStatus("artwork");
const presentEditionStatus = presentStatus("edition");

type Artwork = AdminArtistDetail["artworks"][number];
type Edition = AdminArtistDetail["editions"][number];
type Sale = AdminArtistDetail["sales"][number];

export const ARTIST_SALE_CHANNEL_LABELS: Record<string, string> = {
  shop_order: "LAX Shop order",
  third_party: "Third-party sale",
};

const SEO_FIELD_IDS = { seoTitle: "artist-seo-title", seoDescription: "artist-seo-description" };
const EMAIL_FIELD_ID = "artist-sign-in-email";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function seoErrors(
  values: SeoFieldsFormValues,
): Partial<Record<keyof SeoFieldsFormValues, string>> {
  return {
    ...(values.seoTitle.trim().length > SEO_TITLE_MAX_LENGTH
      ? { seoTitle: SEO_FIELD_ERRORS.seoTitle }
      : {}),
    ...(values.seoDescription.trim().length > SEO_DESCRIPTION_MAX_LENGTH
      ? { seoDescription: SEO_FIELD_ERRORS.seoDescription }
      : {}),
  };
}

function emailError(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Enter the email address they sign in with.";
  if (!EMAIL_PATTERN.test(trimmed)) return "Enter an email address like name@example.com.";
  return null;
}

function counter(value: string, max: number) {
  return `${value.trim().length} of ${max} characters`;
}

/**
 * One artist on the staff record template. The header carries who they are and the one next
 * step, a new artwork; archive and restore sit in the overflow. The main column lists their
 * artworks, editions and sales; the rail holds their sign-in link and their search listing,
 * each saved on its own, behind one unsaved-changes guard.
 */
export function ArtistRecordPage({
  detail,
  canWrite,
}: {
  detail: AdminArtistDetail;
  canWrite: boolean;
}) {
  const { artist, artworks, editions, sales } = detail;
  const archived = artist.archived ?? false;
  const liveArtworkCount = artworks.filter(
    (row) => row.state === "live" || row.state === "sold_out",
  ).length;
  const [archiving, setArchiving] = useState<ArtistArchiveTarget | null>(null);

  // Search listing
  const seoAction = useAdminAction();
  const [savedSeo, setSavedSeo] = useState(() => seoFieldsFormValues(artist));
  const [seo, setSeo] = useState(savedSeo);
  const [seoAttempts, setSeoAttempts] = useState(0);
  const seoFieldErrors = seoAttempts > 0 ? seoErrors(seo) : {};
  const seoDirty =
    seo.seoTitle.trim() !== savedSeo.seoTitle.trim() ||
    seo.seoDescription.trim() !== savedSeo.seoDescription.trim();

  // Sign-in link
  const linkAction = useAdminAction();
  const unlinkAction = useAdminAction();
  const [email, setEmail] = useState("");
  const [emailAttempts, setEmailAttempts] = useState(0);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const emailFieldError = emailAttempts > 0 ? emailError(email) : null;

  const guard = useUnsavedChanges(seoDirty || email.trim() !== "", {
    label: artist.displayName,
  });

  async function saveSeo() {
    setSeoAttempts((count) => count + 1);
    if (Object.keys(seoErrors(seo)).length > 0) return;
    const body = {
      seoTitle: seo.seoTitle.trim() || null,
      seoDescription: seo.seoDescription.trim() || null,
    };
    const ok = await seoAction.run(
      () =>
        updateArtistSeo({
          artistId: artist.artistId,
          ...body,
          idempotencyKey: seoAction.idempotencyKey,
        }),
      "Search listing saved",
      "save this search listing",
    );
    if (ok) {
      const next = seoFieldsFormValues(body);
      setSavedSeo(next);
      setSeo(next);
      setSeoAttempts(0);
    }
  }

  async function link() {
    setEmailAttempts((count) => count + 1);
    if (emailError(email)) return;
    const ok = await linkAction.run(
      () =>
        linkArtistIdentity({
          artistId: artist.artistId,
          email: email.trim(),
          idempotencyKey: linkAction.idempotencyKey,
        }),
      `Sign-in linked to ${artist.displayName}`,
      "link this sign-in",
    );
    if (ok) {
      setEmail("");
      setEmailAttempts(0);
    }
  }

  async function unlink() {
    const ok = await unlinkAction.run(
      () =>
        unlinkArtistIdentity({
          artistId: artist.artistId,
          idempotencyKey: unlinkAction.idempotencyKey,
        }),
      `Sign-in unlinked from ${artist.displayName}`,
      "unlink this sign-in",
    );
    if (ok) setConfirmingUnlink(false);
  }

  const artworkColumns: DataColumn<Artwork>[] = [
    {
      id: "title",
      header: "Artwork",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell href={`/artworks/${row.artworkId}`} Link={NextLink}>
          {row.title}
        </PrimaryCell>
      ),
    },
    {
      id: "state",
      header: "Status",
      width: "136px",
      mobile: "badge",
      truncate: false,
      cell: (row) =>
        row.state ? <MappedStatusBadge status={row.state} present={presentArtworkStatus} /> : "",
    },
  ];

  const editionColumns: DataColumn<Edition>[] = [
    {
      id: "artwork",
      header: "Artwork",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell
          href={`/artworks/${row.artworkId}`}
          Link={NextLink}
          secondary={`Edition ${row.editionNumber}`}
        >
          {row.artworkTitle}
        </PrimaryCell>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "136px",
      mobile: "badge",
      truncate: false,
      cell: (row) => (
        <MappedStatusBadge status={row.listingStatus} present={presentEditionStatus} />
      ),
    },
    {
      id: "owner",
      header: "Held by",
      width: "34%",
      mobile: "meta",
      cell: (row) => (
        <PersonCell name={row.ownerDisplayName} href={`/clients/${row.ownerPartyId}`} />
      ),
    },
  ];

  const saleColumns: DataColumn<Sale>[] = [
    {
      id: "artwork",
      header: "Artwork",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell
          secondary={
            row.editionNumber == null
              ? (ARTIST_SALE_CHANNEL_LABELS[row.channel] ?? "Sale")
              : `Edition ${row.editionNumber} · ${ARTIST_SALE_CHANNEL_LABELS[row.channel] ?? "Sale"}`
          }
        >
          {row.artworkTitle}
        </PrimaryCell>
      ),
    },
    {
      id: "payee",
      header: "Paid to",
      width: "26%",
      mobile: "meta",
      cell: (row) => <PersonCell name={row.payeeDisplayName} />,
    },
    {
      id: "gross",
      header: "Gross",
      width: "112px",
      numeric: true,
      mobile: "meta",
      cell: (row) => <StaffMoney minor={row.grossPence} />,
    },
    {
      id: "when",
      header: "When",
      width: "176px",
      mobile: "meta",
      truncate: false,
      cell: (row) => (row.occurredAt ? <StaffDate value={row.occurredAt} withTime /> : ""),
    },
  ];

  const overflowActions = [
    ...(artworks.length > 0
      ? [
          {
            id: "artworks",
            label: "Show in the artwork list",
            icon: Images,
            href: artistArtworksHref(artist.artistId),
          },
        ]
      : []),
    ...(canWrite
      ? [
          archived
            ? {
                id: "restore",
                label: "Restore artist…",
                icon: ArchiveRestore,
                onSelect: () =>
                  setArchiving({
                    artistId: artist.artistId,
                    displayName: artist.displayName,
                    archived,
                  }),
              }
            : {
                id: "archive",
                label: "Archive artist…",
                icon: Archive,
                tone: "danger" as const,
                onSelect: () =>
                  setArchiving({
                    artistId: artist.artistId,
                    displayName: artist.displayName,
                    archived,
                    liveArtworkCount,
                  }),
              },
        ]
      : []),
  ];

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Artists", href: ARTIST_LIST_PATH }, { label: artist.displayName }]}
          />
        }
        title={artist.displayName}
        status={
          <MappedStatusBadge
            status={archived ? "archived" : "active"}
            present={presentArtistStatus}
          />
        }
        meta={
          <>
            <MetaItem label="Web address">/{artist.slug}</MetaItem>
            {artist.discipline ? <MetaItem label="Discipline">{artist.discipline}</MetaItem> : null}
            <MetaItem label="Works">{artworkCountLabel(artworks.length)}</MetaItem>
          </>
        }
        access={canWrite ? "full" : "read-only"}
        primaryAction={
          canWrite && !archived ? (
            <StaffButton asChild variant="primary" icon={<Plus aria-hidden />}>
              <Link href={`/artworks/new?artist=${artist.artistId}`}>New artwork</Link>
            </StaffButton>
          ) : null
        }
        overflow={
          overflowActions.length > 0 ? (
            <OverflowMenu
              Link={NextLink}
              label={`More actions for ${artist.displayName}`}
              actions={overflowActions}
            />
          ) : null
        }
        rail={
          <>
            {canWrite ? (
              <Section
                title="Sign-in"
                description="Link the account the artist signs in with, so they can manage their profile and sales in LAX Account."
              >
                <form
                  noValidate
                  className="flex flex-col gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void link();
                  }}
                >
                  {linkAction.error}
                  <Field
                    id={EMAIL_FIELD_ID}
                    label="Email address"
                    description="The address on their LAX account."
                    error={emailFieldError}
                  >
                    <TextInput
                      type="email"
                      autoComplete="off"
                      value={email}
                      disabled={linkAction.pending}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </Field>
                  <FormActions
                    start={
                      <StaffButton
                        type="button"
                        variant="ghost"
                        icon={<Link2Off aria-hidden />}
                        onClick={() => setConfirmingUnlink(true)}
                      >
                        Unlink sign-in…
                      </StaffButton>
                    }
                  >
                    <StaffButton type="submit" variant="secondary" loading={linkAction.pending}>
                      Link sign-in
                    </StaffButton>
                  </FormActions>
                </form>
              </Section>
            ) : null}

            <Section
              title="Search listing"
              description="How the artist's page shows in search results. Leave a field blank to use the generated text."
            >
              {canWrite ? null : (
                <KeyValueList
                  items={[
                    { label: "Title", value: savedSeo.seoTitle || "Generated" },
                    { label: "Description", value: savedSeo.seoDescription || "Generated" },
                  ]}
                />
              )}
              {canWrite ? (
                <form
                  noValidate
                  className="flex flex-col gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveSeo();
                  }}
                >
                  <FormErrorSummary
                    focusKey={seoAttempts}
                    errors={Object.entries(seoFieldErrors).map(([field, message]) => ({
                      fieldId: SEO_FIELD_IDS[field as keyof SeoFieldsFormValues],
                      message,
                    }))}
                  />
                  {seoAction.error}
                  <Field
                    id={SEO_FIELD_IDS.seoTitle}
                    label="Title"
                    optional
                    description={counter(seo.seoTitle, SEO_TITLE_MAX_LENGTH)}
                    error={seoFieldErrors.seoTitle}
                  >
                    <TextInput
                      value={seo.seoTitle}
                      disabled={seoAction.pending}
                      onChange={(event) => setSeo({ ...seo, seoTitle: event.target.value })}
                    />
                  </Field>
                  <Field
                    id={SEO_FIELD_IDS.seoDescription}
                    label="Description"
                    optional
                    description={counter(seo.seoDescription, SEO_DESCRIPTION_MAX_LENGTH)}
                    error={seoFieldErrors.seoDescription}
                  >
                    <TextArea
                      rows={3}
                      value={seo.seoDescription}
                      disabled={seoAction.pending}
                      onChange={(event) => setSeo({ ...seo, seoDescription: event.target.value })}
                    />
                  </Field>
                  <FormActions>
                    <StaffButton type="submit" variant="secondary" loading={seoAction.pending}>
                      Save search listing
                    </StaffButton>
                  </FormActions>
                </form>
              ) : null}
            </Section>

            <Section title="Record">
              <KeyValueList
                items={[
                  {
                    label: "Added",
                    value: formatStaffDateTime(artist.createdAt, { zoneLabel: true }),
                  },
                  { label: "Artist ID", value: artist.artistId, copyValue: artist.artistId },
                ]}
              />
            </Section>
          </>
        }
      >
        <Section
          title="Artworks"
          description="Drafts and archived works included."
          bodyClassName="p-0"
        >
          <DataTable
            label={`Artworks by ${artist.displayName}`}
            columns={artworkColumns}
            data={artworks}
            getRowId={(row) => row.artworkId}
            empty={
              <EmptyState
                size="compact"
                headingLevel="h3"
                illustration="easel"
                title="No artworks yet"
                description={
                  canWrite && !archived
                    ? "Add their first work with New artwork."
                    : "Their works will be listed here."
                }
              />
            }
          />
        </Section>
        <Section
          title="Editions"
          description="Editions of their works and who holds each one."
          bodyClassName="p-0"
        >
          <DataTable
            label={`Editions of works by ${artist.displayName}`}
            columns={editionColumns}
            data={editions}
            getRowId={(row) => row.editionId}
            empty={
              <EmptyState
                size="compact"
                headingLevel="h3"
                illustration="frame"
                title="No editions yet"
                description="Editions of their works, and who holds them, will be listed here."
              />
            }
          />
        </Section>
        <Section
          title="Sales"
          description="Sales of their work from every channel."
          bodyClassName="p-0"
        >
          <DataTable
            label={`Sales of works by ${artist.displayName}`}
            columns={saleColumns}
            data={sales}
            getRowId={(row) => row.saleId}
            empty={
              <EmptyState
                size="compact"
                headingLevel="h3"
                illustration="ledger"
                title="No sales yet"
                description="Sales of their work, from any channel, will be listed here."
              />
            }
          />
        </Section>
      </DetailPage>

      <ConfirmActionDialog
        open={confirmingUnlink}
        onOpenChange={(open) => {
          if (!unlinkAction.pending) setConfirmingUnlink(open);
        }}
        title={`Unlink ${artist.displayName}'s sign-in?`}
        description="The account they sign in with stops managing this artist in LAX Account. Their profile, works and sales stay as they are, and you can link a sign-in again by email."
        confirmLabel="Unlink sign-in"
        tone="danger"
        loading={unlinkAction.pending}
        onConfirm={() => void unlink()}
      >
        {unlinkAction.error}
      </ConfirmActionDialog>
      <ArtistArchiveDialog target={archiving} onClose={() => setArchiving(null)} />
      <UnsavedChangesDialog guard={guard} />
      {seoAction.stepUpDialog}
      {linkAction.stepUpDialog}
      {unlinkAction.stepUpDialog}
    </>
  );
}
