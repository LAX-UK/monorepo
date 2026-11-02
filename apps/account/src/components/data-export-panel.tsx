import { Button } from "@/components/account-button";
import type { DataExportProblem } from "@/server/domain/data-export-routes";
import type { DataExportPageVm, DataExportProductVm } from "@/server/domain/data-export.vm";
import { SUBJECT_EXPORT_PRODUCT_INFO } from "@auction/identity-contracts";
import { cn } from "@auction/ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import {
  CARD,
  CARD_PADDING,
  ListCard,
  ListCardRow,
  NOTICE,
  NoticeTitle,
  SECTION_TITLE,
} from "./account-ui";
import { DataExportReadyActions } from "./data-export-ready-actions.client";
import { RequestDataExportButton } from "./data-export-request-button.client";
import { RefreshOnFocus } from "./refresh-on-focus.client";

/** What each product's file holds, in the person's words (the wireframe's "What's included"). */
const INCLUDED: ReadonlyArray<{ product: "account" | "bid" | "shop"; contents: string }> = [
  { product: "account", contents: "Profile, contact, addresses, sign-ins, consents" },
  {
    product: "bid",
    contents: "Registrations, bids, purchases, invoices, consignments, messages, watchlist",
  },
  { product: "shop", contents: "Orders, invoices, enquiries, saved works" },
];

const PROBLEM_COPY: Record<DataExportProblem, { title: string; body: string }> = {
  download_unavailable: {
    title: "We couldn't start your download",
    body: "Your copy is still here and nothing was lost. Try Download again in a moment.",
  },
  step_up_failed: {
    title: "We couldn't confirm it's you",
    body: "Nothing was downloaded. Press Download to try again.",
  },
};

function StatusIcon({ state }: { state: DataExportProductVm["state"] }) {
  if (state === "done") {
    return (
      // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the row states the status in words
      <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-success" fill="none">
        <path
          d="M3 8.5l3.2 3L13 4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the row states the status in words
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn("size-4 text-on-surface-variant", state === "waiting" ? "opacity-60" : "")}
      fill="none"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray={state === "waiting" ? "2 3" : undefined}
      />
      {state !== "waiting" ? (
        <path d="M8 4.5V8l2.2 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

function Progress({ products }: { products: DataExportProductVm[] }) {
  return (
    <ListCard>
      {products.map((entry) => (
        <ListCardRow
          key={entry.product}
          title={entry.name}
          trailing={
            <span className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
              <StatusIcon state={entry.state} />
              {entry.label}
            </span>
          }
        />
      ))}
    </ListCard>
  );
}

function StatusCard({
  id,
  title,
  children,
}: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn(CARD, CARD_PADDING, "flex flex-col gap-4")}>
      <h2 id={id} className={SECTION_TITLE}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The quiet, always-present route for what a person has to review (D2). */
function FullCopyNote({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <p className="text-sm text-on-surface-variant">
      Some things need a person to review, such as notes our team keeps.{" "}
      <a href={href} className="font-medium text-primary underline underline-offset-4">
        Request a full copy
      </a>
    </p>
  );
}

/**
 * The body of Download your data, one panel per kind of answer (wireframes A to F). Nothing here
 * decides what is allowed: Identity does, and the view model only shapes its answer.
 */
export function DataExportPanel({
  vm,
  fullCopyHref,
  contactHref,
  retryHref,
  resume,
  problem,
}: {
  vm: DataExportPageVm;
  fullCopyHref: string | null;
  contactHref: string | null;
  retryHref: string;
  resume: "request" | "download" | null;
  problem: DataExportProblem | null;
}) {
  const note = <FullCopyNote href={fullCopyHref} />;
  const notice = problem ? PROBLEM_COPY[problem] : null;
  const banner = notice ? (
    <Alert variant="warning" className={NOTICE}>
      <NoticeTitle>{notice.title}</NoticeTitle>
      <AlertDescription>{notice.body}</AlertDescription>
    </Alert>
  ) : null;

  switch (vm.kind) {
    case "unavailable":
      return (
        <Alert variant="destructive" className={NOTICE}>
          <NoticeTitle>We can't check your data copy right now</NoticeTitle>
          <AlertDescription>
            This is a temporary problem on our side and nothing has changed. Try again in a moment.
          </AlertDescription>
          <Button asChild variant="outline" className="mt-4">
            <a href={retryHref}>Try again</a>
          </Button>
        </Alert>
      );

    case "ready_to_request":
      return (
        <div className="flex flex-col gap-8">
          <section aria-labelledby="included-heading" className="flex flex-col gap-4">
            <h2 id="included-heading" className={SECTION_TITLE}>
              What's included
            </h2>
            <ListCard>
              {INCLUDED.map((entry) => (
                <ListCardRow
                  key={entry.product}
                  title={SUBJECT_EXPORT_PRODUCT_INFO[entry.product].name}
                  subtitle={entry.contents}
                />
              ))}
            </ListCard>
            <p className="text-sm text-on-surface-variant">
              One ZIP file: a summary you can read, and data files you can take elsewhere.
            </p>
          </section>
          <div className="flex flex-col gap-4">
            <RequestDataExportButton resume={resume === "request"} />
            {note}
          </div>
        </div>
      );

    case "preparing":
      return (
        <div className="flex flex-col gap-6">
          <RefreshOnFocus />
          <StatusCard id="status-heading" title="Preparing">
            <p className="text-sm text-on-surface-variant">
              Requested {vm.requestedAt}.{" "}
              {vm.email
                ? `We'll email ${vm.email} when it's ready.`
                : "We'll email you when it's ready."}{" "}
              You can leave this page.
            </p>
            <Progress products={vm.products} />
          </StatusCard>
          <div className="flex flex-col gap-3">
            <Button
              variant="cta"
              disabled
              aria-describedby="one-at-a-time"
              className="w-full sm:w-fit"
            >
              Request your data
            </Button>
            <p id="one-at-a-time" className="text-sm text-on-surface-variant">
              One request at a time.
            </p>
            {note}
          </div>
        </div>
      );

    case "delayed":
      return (
        <div className="flex flex-col gap-6">
          <RefreshOnFocus />
          <StatusCard id="status-heading" title="Taking longer than usual">
            <p className="text-sm text-on-surface-variant">
              One of our services didn't answer, so we're trying again. You don't need to do
              anything. We'll email {vm.email ?? "you"} when it's ready, and no later than{" "}
              {vm.dueOn}.
            </p>
            <Progress products={vm.products} />
            {contactHref ? (
              <p className="text-sm text-on-surface-variant">
                Questions?{" "}
                <a
                  href={contactHref}
                  className="font-medium text-primary underline underline-offset-4"
                >
                  Contact us
                </a>
              </p>
            ) : null}
          </StatusCard>
          {note}
        </div>
      );

    case "ready":
      return (
        <div className="flex flex-col gap-6">
          {banner}
          <StatusCard id="status-heading" title="Ready">
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium break-all text-on-surface">
                {vm.fileName} · {vm.size}
              </p>
              <p className="text-sm text-on-surface-variant">
                Prepared {vm.preparedAt} · available until {vm.availableUntil} · {vm.downloads}
              </p>
            </div>
            {vm.largeFile ? (
              <p className="text-sm text-on-surface-variant">
                Large file. On mobile data it may take a while.
              </p>
            ) : null}
            <DataExportReadyActions exportId={vm.exportId} resume={resume === "download"} />
            <div className="flex flex-col gap-2 text-sm text-on-surface-variant">
              <p>
                Keep the file somewhere safe: it contains your personal details, addresses and
                payment history.
              </p>
              <p>You can request a new copy after this one expires or once you delete it.</p>
            </div>
          </StatusCard>
          {note}
        </div>
      );

    case "expired":
      return (
        <div className="flex flex-col gap-6">
          <StatusCard id="status-heading" title="Expired">
            <p className="text-sm text-on-surface-variant">{vm.message}</p>
            <RequestDataExportButton label="Request a new copy" resume={resume === "request"} />
          </StatusCard>
          {note}
        </div>
      );
  }
}
