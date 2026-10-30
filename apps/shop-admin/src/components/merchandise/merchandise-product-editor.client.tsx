"use client";

import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { MerchandiseConflictBanner } from "@/components/merchandise/merchandise-conflict-banner.client";
import { MerchandiseVariants } from "@/components/merchandise/merchandise-variants.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  conflictField,
  slugFromTitle,
  validateNewProduct,
  validateProductFields,
} from "@/lib/merchandise-form";
import {
  createMerchandiseProduct,
  getMerchandiseProductDetail,
  saveMerchandiseProduct,
  setMerchandiseProductArchived,
} from "@/server/application/admin-merchandise-actions.server";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import { presentStatus } from "@/server/domain/staff-status";
import type { MerchandiseProductDetail } from "@auction/shop-contracts";
import {
  ConfirmActionDialog,
  Field,
  FieldRow,
  FormActions,
  FormErrorSummary,
  FormPage,
  FormSection,
  MappedStatusBadge,
  MoneyInput,
  Notice,
  StaffButton,
  TextArea,
  TextInput,
  UnsavedChangesDialog,
  formatStaffDateTime,
  parsePoundsToPence,
  toast,
  useStaffCan,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { Archive, ArchiveRestore, Save } from "@auction/staff-ui/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Form = {
  title: string;
  slug: string;
  description: string;
  sku: string;
  price: string;
  onHand: string;
};

type Failure = { text: string; stepUp: boolean };
type Busy = "save" | "archive" | "reload";
type Dialog = "archive" | "reload" | "overwrite";

const FORM_ID = "merchandise-product-form";
const newKey = () => crypto.randomUUID();
const presentMerchandiseStatus = presentStatus("merchandise");

/** Fields in the order they appear, which is the order the error summary lists them. */
const FIELD_ORDER = ["title", "slug", "description", "sku", "price", "onHand"] as const;
type FormField = (typeof FIELD_ORDER)[number];
const fieldId = (field: FormField) => `product-${field}`;

function formFrom(detail: MerchandiseProductDetail | null): Form {
  return {
    title: detail?.title ?? "",
    slug: detail?.slug ?? "",
    description: detail?.description ?? "",
    sku: "",
    price: "",
    onHand: "0",
  };
}

function failureFrom(
  result: Exclude<AdminMutationResult<unknown>, { ok: true }>,
  action: string,
): Failure {
  const text =
    result.kind === "failed"
      ? `Could not ${action}. The service is unavailable. Try again.`
      : adminMutationErrorMessage(result);
  return { text, stepUp: result.kind === "step_up_required" };
}

/**
 * Create or edit one product. Saving is explicit; archiving asks first; and edits are protected
 * from being lost by leaving the page or from silently replacing a newer save by someone else.
 * Errors show beside their field and in a summary after a failed save, and clear as each field is
 * fixed. Variants are listed below the form for a saved product, each change to them saved on its
 * own.
 */
export function MerchandiseProductEditor({ detail }: { detail: MerchandiseProductDetail | null }) {
  const productId = detail?.productId ?? null;
  const router = useRouter();
  const pathname = usePathname();

  const [form, setForm] = useState<Form>(() => formFrom(detail));
  const [baseline, setBaseline] = useState<Form>(form);
  // A new product's slug follows its title until staff type their own.
  const [slugTouched, setSlugTouched] = useState(false);
  const [version, setVersion] = useState<string | null>(detail?.version ?? null);
  const [savedAt, setSavedAt] = useState<string | null>(detail?.version ?? null);
  const [status, setStatus] = useState(detail?.status ?? "active");
  /** Failed saves so far; errors show live once there has been one. */
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [serverErrors, setServerErrors] = useState<Partial<Record<FormField, string>>>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [conflictVersion, setConflictVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const dirty = FIELD_ORDER.some((field) => form[field] !== baseline[field]);
  const leaveGuard = useUnsavedChanges(dirty, {
    navigate: (href) => router.push(href),
    ...(detail?.title ? { label: `“${detail.title}”` } : {}),
  });
  const releaseGuard = leaveGuard.release;

  const checked = productId ? validateProductFields(form) : validateNewProduct(form);
  const clientErrors = failedSubmits > 0 && !checked.ok ? checked.errors : {};
  const errors: Partial<Record<string, string>> = { ...serverErrors, ...clientErrors };
  const summary = FIELD_ORDER.flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: fieldId(field), message }] : [];
  });

  /** A repeat of the same request reuses its key; a changed request gets a new one. */
  function keyFor(signature: string): string {
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: newKey() };
    return attempt.current.key;
  }

  async function attemptMutation<T>(
    work: () => Promise<AdminMutationResult<T>>,
  ): Promise<AdminMutationResult<T>> {
    try {
      return await work();
    } catch {
      return { ok: false, kind: "failed", message: "" };
    }
  }

  function edit(change: Partial<Form>) {
    setForm((current) => ({ ...current, ...change }));
    if (Object.keys(serverErrors).length > 0) setServerErrors({});
  }

  function editTitle(title: string) {
    edit(!productId && !slugTouched ? { title, slug: slugFromTitle(title) } : { title });
  }

  /** A 409 without a version is a taken slug or SKU: show it against that field. */
  function showConflict(message: string): boolean {
    const field = conflictField(message);
    if (!field) return false;
    setServerErrors({ [field]: message });
    setFailedSubmits((count) => count + 1);
    return true;
  }

  async function create() {
    const found = validateNewProduct(form);
    if (!found.ok) {
      setFailedSubmits((count) => count + 1);
      setFailure(null);
      return;
    }
    setFailure(null);
    setBusy("save");
    const result = await attemptMutation(() =>
      createMerchandiseProduct({
        payload: found.value,
        idempotencyKey: keyFor(JSON.stringify(found.value)),
      }),
    );
    setBusy(null);
    if (!result.ok) {
      if (result.kind !== "conflict" || !showConflict(result.message)) {
        setFailure(failureFrom(result, "create the product"));
      }
      return;
    }
    attempt.current = null;
    setBaseline(form);
    toast.success("Product created.");
    // Drop the Back-button sentinel first; its clean-up history.back() would cancel this replace.
    await releaseGuard();
    router.replace(`/merchandise/${result.data.productId}`);
  }

  async function save(expectedVersion: string | null = version) {
    if (!productId || !expectedVersion || busy !== null) return;
    if (!dirty && !conflictVersion) {
      toast.info("Nothing has changed.");
      return;
    }
    const found = validateProductFields(form);
    if (!found.ok) {
      setFailedSubmits((count) => count + 1);
      setFailure(null);
      return;
    }
    setFailure(null);
    setBusy("save");
    const result = await attemptMutation(() =>
      saveMerchandiseProduct({
        productId,
        payload: found.value,
        expectedVersion,
        idempotencyKey: keyFor(JSON.stringify([productId, expectedVersion, found.value])),
      }),
    );
    setBusy(null);
    if (!result.ok) {
      if (result.kind === "conflict" && result.currentVersion) {
        setConflictVersion(result.currentVersion);
      } else if (result.kind !== "conflict" || !showConflict(result.message)) {
        setFailure(failureFrom(result, "save the product"));
      }
      return;
    }
    attempt.current = null;
    setBaseline(form);
    setFailedSubmits(0);
    setConflictVersion(null);
    setVersion(result.data.version);
    setSavedAt(result.data.version);
    toast.success("Product saved.");
    router.refresh();
  }

  async function changeArchived() {
    if (!productId) return;
    const archive = status === "active";
    setBusy("archive");
    setFailure(null);
    const result = await attemptMutation(() =>
      setMerchandiseProductArchived({
        productId,
        archived: archive,
        idempotencyKey: keyFor(`${productId}:${archive}:${version}`),
      }),
    );
    setBusy(null);
    setDialog(null);
    if (!result.ok) {
      setFailure(failureFrom(result, archive ? "archive the product" : "restore the product"));
      return;
    }
    attempt.current = null;
    setStatus(archive ? "archived" : "active");
    setVersion(result.data.version);
    setSavedAt(result.data.version);
    toast.success(archive ? "Product archived." : "Product restored.");
    router.refresh();
  }

  /** Replaces the editor with what is stored now, discarding every unsaved edit. */
  async function reloadFromStore() {
    if (!productId) return;
    setBusy("reload");
    const result = await attemptMutation(() => getMerchandiseProductDetail(productId));
    setBusy(null);
    setDialog(null);
    if (!result.ok) {
      setFailure(failureFrom(result, "reload the product"));
      return;
    }
    const next = formFrom(result.data);
    setForm(next);
    setBaseline(next);
    setVersion(result.data.version);
    setSavedAt(result.data.version);
    setStatus(result.data.status);
    setFailedSubmits(0);
    setServerErrors({});
    setFailure(null);
    setConflictVersion(null);
    router.refresh();
  }

  // Staff who may only read merchandise see the product as it is, with nothing to change.
  const canWrite = useStaffCan("merchandise.write");
  const disabled = busy !== null || !canWrite;
  const name = form.title.trim() || "this product";
  const archiving = status === "active";
  const heading = detail ? detail.title : "New product";
  // The money field resets its text whenever `value` differs from what it last parsed, so it is
  // fed its own reading of the text; the form's stricter rules apply on validation.
  const typedPrice = parsePoundsToPence(form.price);
  const conflictTime = conflictVersion ? formatStaffDateTime(conflictVersion) : "the last save";

  return (
    <FormPage
      breadcrumbs={
        <AdminBreadcrumbs list={{ label: "Products", href: "/merchandise" }} current={heading} />
      }
      title={heading}
      description={
        detail
          ? `/${detail.slug}`
          : "Add the product and its first variant. It goes on sale as soon as it is created and has stock."
      }
      notice={
        <>
          {!canWrite ? (
            <Notice tone="info" title="View only">
              Your roles let you see this product but not change it.
            </Notice>
          ) : null}
          {status === "archived" ? (
            <Notice tone="warning" title="This product is archived">
              It is not shown on the shop and cannot be bought. Restore it to put it back on sale.
            </Notice>
          ) : null}
          {conflictVersion ? (
            <MerchandiseConflictBanner
              savedAt={conflictTime}
              busy={disabled}
              onReload={() => setDialog("reload")}
              onKeepMine={() => setDialog("overwrite")}
            />
          ) : null}
          {failure ? (
            <Notice
              tone="danger"
              alert
              title={failure.text}
              {...(failure.stepUp
                ? {
                    actions: (
                      <StaffButton asChild size="sm" variant="secondary">
                        <a href={`/api/auth/login?returnTo=${encodeURIComponent(pathname)}`}>
                          Sign in again
                        </a>
                      </StaffButton>
                    ),
                  }
                : {})}
            />
          ) : null}
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        aria-label={productId ? `Edit ${detail?.title ?? "product"}` : "New product"}
        className="flex flex-col gap-6 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void (productId ? save() : create());
        }}
      >
        <FormErrorSummary errors={summary} focusKey={failedSubmits} />

        <FormSection
          title="Product details"
          description="What shoppers see on the product page and in its web address."
        >
          <Field label="Title" id={fieldId("title")} error={errors.title} disabled={disabled}>
            <TextInput
              value={form.title}
              maxLength={200}
              autoComplete="off"
              onChange={(event) => editTitle(event.target.value)}
            />
          </Field>
          <Field
            label="Slug"
            id={fieldId("slug")}
            description={
              productId
                ? "Part of the product's web address. Changing it stops existing links working."
                : "Part of the product's web address, such as tote-bag."
            }
            error={errors.slug}
            disabled={disabled}
          >
            <TextInput
              value={form.slug}
              maxLength={120}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setSlugTouched(true);
                edit({ slug: event.target.value });
              }}
            />
          </Field>
          <Field
            label="Description"
            optional
            id={fieldId("description")}
            description="Shown on the product page."
            error={errors.description}
            disabled={disabled}
          >
            <TextArea
              rows={6}
              maxLength={4000}
              value={form.description}
              onChange={(event) => edit({ description: event.target.value })}
            />
          </Field>
        </FormSection>

        {productId ? null : (
          <FormSection
            title="First variant"
            description="A product needs one SKU to be sold. You can add more variants once it is created."
          >
            <Field label="SKU" id={fieldId("sku")} error={errors.sku} disabled={disabled}>
              <TextInput
                value={form.sku}
                maxLength={64}
                autoComplete="off"
                onChange={(event) => edit({ sku: event.target.value })}
              />
            </Field>
            <FieldRow>
              <Field
                label="Price"
                id={fieldId("price")}
                description="In pounds, for example 12.50."
                error={errors.price}
                disabled={disabled}
              >
                <MoneyInput
                  value={typedPrice.ok ? typedPrice.pence : null}
                  onValueChange={() => undefined}
                  onInput={(event) => edit({ price: event.currentTarget.value })}
                  placeholder="0.00"
                />
              </Field>
              <Field
                label="Opening stock"
                id={fieldId("onHand")}
                error={errors.onHand}
                disabled={disabled}
              >
                <TextInput
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.onHand}
                  onChange={(event) => edit({ onHand: event.target.value })}
                />
              </Field>
            </FieldRow>
          </FormSection>
        )}

        {detail ? (
          <FormSection
            title="Availability"
            description="Whether the product is on the shop. Archiving removes it from sale and nothing is deleted."
          >
            <div className="flex flex-wrap items-center gap-3">
              <MappedStatusBadge status={status} present={presentMerchandiseStatus} />
              <StaffButton
                type="button"
                requires="merchandise.write"
                variant={archiving ? "danger-secondary" : "secondary"}
                icon={archiving ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
                disabled={disabled || (archiving && dirty)}
                loading={busy === "archive"}
                onClick={() => (archiving ? setDialog("archive") : void changeArchived())}
              >
                {archiving ? "Archive product" : "Restore product"}
              </StaffButton>
            </div>
            {archiving && dirty ? (
              <p className="text-staff-sm text-staff-muted">
                Save your changes before archiving this product.
              </p>
            ) : null}
          </FormSection>
        ) : null}

        <FormActions
          start={
            <output aria-live="polite" className="text-staff-sm text-staff-muted">
              {dirty ? "Unsaved changes" : savedAt ? `Saved ${formatStaffDateTime(savedAt)}` : null}
            </output>
          }
        >
          <StaffButton asChild variant="secondary">
            <Link href="/merchandise">Cancel</Link>
          </StaffButton>
          <StaffButton
            type="submit"
            requires="merchandise.write"
            variant="primary"
            icon={<Save aria-hidden />}
            loading={busy === "save"}
            disabled={busy !== null && busy !== "save"}
          >
            {productId ? "Save changes" : "Create product"}
          </StaffButton>
        </FormActions>
      </form>

      {detail ? (
        <MerchandiseVariants productId={detail.productId} variants={detail.variants} />
      ) : null}

      <ConfirmActionDialog
        open={dialog === "archive"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Archive “${name}”?`}
        description="The product is removed from the shop straight away: it no longer appears in the catalogue, its page is not found, and shoppers who hold it in a basket can no longer check out with it. Orders already placed are not affected and nothing is deleted. You can restore it later."
        confirmLabel="Archive product"
        tone="danger"
        loading={busy === "archive"}
        onConfirm={() => void changeArchived()}
      />
      <ConfirmActionDialog
        open={dialog === "reload"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Discard your changes to “${name}”?`}
        description={`Reloading shows the version saved at ${conflictTime}. Your unsaved changes to this product are lost and cannot be recovered.`}
        confirmLabel="Discard my changes and reload"
        cancelLabel="Keep editing"
        tone="danger"
        loading={busy === "reload"}
        onConfirm={() => void reloadFromStore()}
      />
      <ConfirmActionDialog
        open={dialog === "overwrite"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Save over the other changes to “${name}”?`}
        description={`Saving now replaces what was saved at ${conflictTime} with your version of this product. Their changes cannot be recovered afterwards.`}
        confirmLabel="Save my version"
        cancelLabel="Go back"
        tone="danger"
        loading={busy === "save"}
        onConfirm={() => {
          const current = conflictVersion;
          setDialog(null);
          if (current) void save(current);
        }}
      />
      <UnsavedChangesDialog guard={leaveGuard} />
    </FormPage>
  );
}
