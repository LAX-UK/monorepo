"use client";

import { TextAreaField, TextField } from "@/components/forms/fields";
import { FormErrorSummary } from "@/components/forms/form-error-summary";
import { FormScopeProvider } from "@/components/forms/form-field";
import { MerchandiseConflictBanner } from "@/components/merchandise/merchandise-conflict-banner.client";
import { MerchandiseStatusBadge } from "@/components/merchandise/merchandise-status-badge";
import { MerchandiseVariants } from "@/components/merchandise/merchandise-variants.client";
import { useUnsavedNavigationGuard } from "@/components/use-unsaved-changes-guard";
import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { type FieldErrors, hasFieldErrors } from "@/lib/form-validation";
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
import type { MerchandiseProductDetail } from "@auction/shop-contracts";
import {
  Alert,
  AlertDescription,
  Button,
  ConfirmDialog,
  LoadingButton,
  StatusBadge,
  StickySaveBar,
  toast,
} from "@auction/ui";
import { usePathname, useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

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
 * Create or edit one product. Saving is explicit, from a sticky bar; archiving asks first; and
 * edits are protected from being lost by leaving the page or from silently replacing a newer
 * save by someone else. Variants are listed below the form for a saved product, each change
 * to them saved on its own.
 */
export function MerchandiseProductEditor({ detail }: { detail: MerchandiseProductDetail | null }) {
  const productId = detail?.productId ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const scope = useId();

  const [form, setForm] = useState<Form>(() => formFrom(detail));
  // A new product's slug follows its title until staff type their own.
  const [slugTouched, setSlugTouched] = useState(false);
  const [version, setVersion] = useState<string | null>(detail?.version ?? null);
  const [savedAt, setSavedAt] = useState<string | null>(detail?.version ?? null);
  const [status, setStatus] = useState(detail?.status ?? "active");
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [conflictVersion, setConflictVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const {
    pending: leavePending,
    stay,
    leave,
    release: releaseGuard,
  } = useUnsavedNavigationGuard(dirty);

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
    setDirty(true);
  }

  function editTitle(title: string) {
    edit(!productId && !slugTouched ? { title, slug: slugFromTitle(title) } : { title });
  }

  /** A 409 without a version is a taken slug or SKU: show it against that field. */
  function showConflict(message: string): boolean {
    const field = conflictField(message);
    if (!field) return false;
    setErrors({ [field]: message });
    return true;
  }

  async function create() {
    const checked = validateNewProduct(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      setFailure(null);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy("save");
    const result = await attemptMutation(() =>
      createMerchandiseProduct({
        payload: checked.value,
        idempotencyKey: keyFor(JSON.stringify(checked.value)),
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
    setDirty(false);
    toast.success("Product created.");
    // Drop the Back-button sentinel first; its clean-up history.back() would cancel this replace.
    await releaseGuard();
    router.replace(`/merchandise/${result.data.productId}`);
  }

  async function save(expectedVersion: string | null = version) {
    if (!productId || !expectedVersion) return;
    const checked = validateProductFields(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      setFailure(null);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy("save");
    const result = await attemptMutation(() =>
      saveMerchandiseProduct({
        productId,
        payload: checked.value,
        expectedVersion,
        idempotencyKey: keyFor(JSON.stringify([productId, expectedVersion, checked.value])),
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
    setDirty(false);
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
    setForm(formFrom(result.data));
    setVersion(result.data.version);
    setSavedAt(result.data.version);
    setStatus(result.data.status);
    setDirty(false);
    setErrors({});
    setFailure(null);
    setConflictVersion(null);
    router.refresh();
  }

  const disabled = busy !== null;
  const name = form.title.trim() || "this product";
  const archiving = status === "active";

  return (
    <div className="space-y-8">
      <FormScopeProvider value={scope}>
        <form
          id={FORM_ID}
          noValidate
          className="space-y-8"
          onSubmit={(event) => {
            event.preventDefault();
            void (productId ? save() : create());
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {productId ? (
              <MerchandiseStatusBadge status={status} />
            ) : (
              <StatusBadge variant="info">New product</StatusBadge>
            )}
            {productId ? (
              <Button
                type="button"
                variant="outline"
                disabled={disabled || (archiving && dirty)}
                onClick={() => (archiving ? setDialog("archive") : void changeArchived())}
              >
                {archiving ? "Archive product" : "Restore product"}
              </Button>
            ) : null}
          </div>
          {productId && archiving && dirty ? (
            <p className="-mt-4 text-sm text-on-surface-variant">
              Save your changes before archiving this product.
            </p>
          ) : null}
          {status === "archived" ? (
            <Alert>
              <AlertDescription>
                This product is archived: it is not shown on the shop and cannot be bought. Restore
                it to put it back on sale.
              </AlertDescription>
            </Alert>
          ) : null}

          {conflictVersion ? (
            <MerchandiseConflictBanner
              savedAt={formatAdminDetailDateTime(conflictVersion)}
              busy={disabled}
              onReload={() => setDialog("reload")}
              onKeepMine={() => setDialog("overwrite")}
            />
          ) : null}
          {failure ? (
            <Alert variant="destructive">
              <AlertDescription>
                {failure.text}
                {failure.stepUp ? (
                  <>
                    {" "}
                    <a
                      href={`/api/auth/login?returnTo=${encodeURIComponent(pathname)}`}
                      className="underline"
                    >
                      Sign in again
                    </a>
                  </>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          {hasFieldErrors(errors) ? <FormErrorSummary scope={scope} errors={errors} /> : null}

          <section aria-labelledby="product-details-heading" className="space-y-4">
            <h2 id="product-details-heading" className="font-headline text-xl font-semibold">
              Product details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="title"
                label="Title"
                value={form.title}
                error={errors.title}
                disabled={disabled}
                maxLength={200}
                onChange={editTitle}
              />
              <TextField
                name="slug"
                label="Slug"
                hint={
                  productId
                    ? "Part of the product's web address. Changing it stops existing links working."
                    : "Part of the product's web address, such as tote-bag."
                }
                value={form.slug}
                error={errors.slug}
                disabled={disabled}
                maxLength={120}
                onChange={(slug) => {
                  setSlugTouched(true);
                  edit({ slug });
                }}
              />
              <TextAreaField
                className="sm:col-span-2"
                name="description"
                label="Description"
                hint="Shown on the product page."
                value={form.description}
                error={errors.description}
                disabled={disabled}
                rows={6}
                maxLength={4000}
                onChange={(description) => edit({ description })}
              />
            </div>
          </section>

          {productId ? null : (
            <section aria-labelledby="first-variant-heading" className="space-y-4">
              <div>
                <h2 id="first-variant-heading" className="font-headline text-xl font-semibold">
                  First variant
                </h2>
                <p className="text-sm text-on-surface-variant">
                  A product needs one SKU to be sold. You can add more variants once it is created.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  name="sku"
                  label="SKU"
                  value={form.sku}
                  error={errors.sku}
                  disabled={disabled}
                  maxLength={64}
                  onChange={(sku) => edit({ sku })}
                />
                <TextField
                  name="price"
                  label="Price (£)"
                  hint="In pounds, for example 12.50."
                  value={form.price}
                  error={errors.price}
                  disabled={disabled}
                  onChange={(price) => edit({ price })}
                />
                <TextField
                  name="onHand"
                  label="Opening stock"
                  type="number"
                  min={0}
                  value={form.onHand}
                  error={errors.onHand}
                  disabled={disabled}
                  onChange={(onHand) => edit({ onHand })}
                />
              </div>
            </section>
          )}
        </form>
      </FormScopeProvider>

      {detail ? (
        <MerchandiseVariants productId={detail.productId} variants={detail.variants} />
      ) : null}

      <StickySaveBar>
        <div className="flex flex-wrap items-center gap-3">
          <LoadingButton
            type="submit"
            form={FORM_ID}
            loading={busy === "save"}
            loadingLabel="Saving…"
            disabled={disabled}
          >
            {productId ? "Save changes" : "Create product"}
          </LoadingButton>
          <output aria-live="polite" className="text-sm text-on-surface-variant">
            {dirty
              ? "Unsaved changes"
              : savedAt
                ? `Saved ${formatAdminDetailDateTime(savedAt)}`
                : "Not saved yet"}
          </output>
        </div>
      </StickySaveBar>

      <ConfirmDialog
        open={dialog === "archive"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Archive “${name}”?`}
        body="The product is removed from the shop straight away: it no longer appears in the catalogue, its page is not found, and shoppers who hold it in a basket can no longer check out with it. Orders already placed are not affected and nothing is deleted. You can restore it later."
        confirmLabel="Archive product"
        tone="warning"
        loading={busy === "archive"}
        onConfirm={changeArchived}
      />
      <ConfirmDialog
        open={dialog === "reload"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Discard your changes to “${name}”?`}
        body={`Reloading shows the version saved at ${conflictVersion ? formatAdminDetailDateTime(conflictVersion) : "the last save"}. Your unsaved changes to this product are lost and cannot be recovered.`}
        confirmLabel="Discard my changes and reload"
        cancelLabel="Keep editing"
        loading={busy === "reload"}
        onConfirm={reloadFromStore}
      />
      <ConfirmDialog
        open={dialog === "overwrite"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={`Save over the other changes to “${name}”?`}
        body={`Saving now replaces what was saved at ${conflictVersion ? formatAdminDetailDateTime(conflictVersion) : "the last save"} with your version of this product. Their changes cannot be recovered afterwards.`}
        confirmLabel="Save my version"
        cancelLabel="Go back"
        loading={busy === "save"}
        onConfirm={async () => {
          const current = conflictVersion;
          setDialog(null);
          if (current) await save(current);
        }}
      />
      <ConfirmDialog
        open={leavePending}
        onOpenChange={(open) => {
          if (!open) stay();
        }}
        title="Leave without saving?"
        body="Your changes to this product have not been saved and will be lost."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        onConfirm={leave}
      />
    </div>
  );
}
