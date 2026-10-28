"use client";

import {
  ARTIST_APPLICATION_FORM_STEPS,
  type ArtistApplicationFieldErrors,
  type ArtistApplicationFormState,
  applicationFieldId,
} from "@/lib/artist-application/artist-application-form";
import { MarketingFormField } from "@auction/marketing-ui";
import type { ArtistApplicationStep } from "@auction/shop-domain";
import { Checkbox } from "@auction/ui/components/checkbox";
import Link from "next/link";

export const ARTIST_APPLICATION_PRIVACY_HREF = "/legal/privacy";

function excerpt(text: string, length = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length - 1).trimEnd()}…` : flat;
}

type Row = { label: string; value: string };

function summary(
  form: ArtistApplicationFormState,
): Record<Exclude<ArtistApplicationStep, "agreement">, Row[]> {
  const links = form.socialLinks.filter((link) => link.trim());
  const works = form.works.length;
  return {
    about: [
      { label: "Name", value: form.artistName.trim() || "Not given yet" },
      { label: "Based in", value: form.location.trim() || "Not given yet" },
      ...(form.website.trim() ? [{ label: "Website", value: form.website.trim() }] : []),
      ...(links.length > 0
        ? [
            {
              label: "Social media",
              value: `${links.length} ${links.length === 1 ? "profile" : "profiles"}`,
            },
          ]
        : []),
    ],
    work: [
      {
        label: "Works",
        value: works === 0 ? "None added yet" : `${works} ${works === 1 ? "work" : "works"}`,
      },
    ],
    statement: [
      {
        label: "Statement",
        value: form.statement.trim() ? excerpt(form.statement) : "Not written yet",
      },
    ],
  };
}

/**
 * Step 4: a last look at each step with a way back to change it, then the one agreement the
 * application needs: that the gallery may contact the artist about it, under London Art
 * Exchange's privacy notice.
 */
export function ApplicationAgreementStep({
  form,
  errors,
  onConsentChange,
  onEditStep,
}: {
  form: ArtistApplicationFormState;
  errors: ArtistApplicationFieldErrors;
  onConsentChange: (consent: boolean) => void;
  onEditStep: (step: ArtistApplicationStep) => void;
}) {
  const rows = summary(form);
  const consentId = applicationFieldId("consentToContact");
  return (
    <div className="flex flex-col gap-10">
      <dl className="m-0 flex flex-col">
        {ARTIST_APPLICATION_FORM_STEPS.filter((step) => step.id !== "agreement").map((step) => (
          <div
            key={step.id}
            className="flex flex-col gap-3 border-t border-outline-variant py-5 last:border-b"
          >
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-headline text-lg font-medium text-on-surface">{step.label}</dt>
              <button
                type="button"
                className="art-focus-ring min-h-11 rounded-sm px-1 font-label text-sm font-medium text-on-surface underline underline-offset-4 hover:decoration-2"
                onClick={() => onEditStep(step.id)}
              >
                Change<span className="sr-only"> {step.label.toLowerCase()}</span>
              </button>
            </div>
            <dd className="m-0">
              <dl className="m-0 grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-6">
                {rows[step.id as Exclude<ArtistApplicationStep, "agreement">].map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-sm text-on-surface-variant">{row.label}</dt>
                    <dd className="m-0 break-words text-sm text-on-surface">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </dd>
          </div>
        ))}
      </dl>

      <MarketingFormField id={consentId} label="Agreement" error={errors.consentToContact ?? null}>
        {(control) => (
          <div className="flex items-start gap-3">
            <Checkbox
              id={control.id}
              aria-invalid={control["aria-invalid"]}
              aria-describedby={control["aria-describedby"]}
              checked={form.consentToContact}
              onCheckedChange={(checked) => onConsentChange(checked === true)}
              className="mt-0.5 size-5 border-input-border"
            />
            <label
              htmlFor={control.id}
              className="cursor-pointer text-base leading-relaxed text-on-surface"
            >
              The gallery may contact me about my application. London Art Exchange uses these
              details to review it, as set out in the{" "}
              <Link
                href={ARTIST_APPLICATION_PRIVACY_HREF}
                className="art-focus-ring rounded-sm font-medium underline underline-offset-2"
                target="_blank"
              >
                privacy notice
              </Link>
              .
            </label>
          </div>
        )}
      </MarketingFormField>
    </div>
  );
}
