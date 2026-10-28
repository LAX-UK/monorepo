"use client";

import {
  type ArtistApplicationActionResult,
  saveArtistApplication,
  submitArtistApplication,
} from "@/lib/artist-application/artist-application-actions.server";
import {
  ARTIST_APPLICATION_FORM_STEPS,
  type ArtistApplicationFieldErrors,
  type ArtistApplicationFormState,
  type ArtistApplicationWorkDraft,
  EMPTY_ARTIST_APPLICATION_FORM,
  applicationFieldId,
  completedSteps,
  formFromApplication,
  mergeServerWorks,
  saveBodyFromForm,
  stepErrors,
} from "@/lib/artist-application/artist-application-form";
import { MarketingFormErrorSummary } from "@auction/marketing-ui";
import type { MyArtistApplication } from "@auction/shop-contracts";
import type { ArtistApplicationStep } from "@auction/shop-domain";
import { WizardNav, WizardProgress } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApplicationAboutStep } from "./application-about-step";
import { ApplicationAgreementStep } from "./application-agreement-step";
import { ApplicationStepHeading } from "./application-fields";
import { ApplicationStatementStep } from "./application-statement-step";
import { ApplicationWorkStep } from "./application-work-step.client";

const STEP_IDS = ARTIST_APPLICATION_FORM_STEPS.map((step) => step.id);
const HEADING_ID = "artist-application-step-heading";

type Notice = { tone: "error" | "saved"; message: string } | null;

/**
 * The application, four calm steps on one page. Each Continue checks only that step, saves the
 * whole application, and moves on; Back keeps every answer. Sending checks every step, takes the
 * artist to the first one with something missing, and otherwise sends it for review.
 */
export function ArtistApplicationForm({
  application,
  sentPath,
}: {
  /** The open application, or null when the first save will start one. */
  application: MyArtistApplication | null;
  /** Where to go once the application is sent. */
  sentPath: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ArtistApplicationFormState>(() =>
    application ? formFromApplication(application) : EMPTY_ARTIST_APPLICATION_FORM,
  );
  const [record, setRecord] = useState<{ id: string; version: number } | null>(
    application ? { id: application.id, version: application.version } : null,
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [reached, setReached] = useState(() => (application ? STEP_IDS.length - 1 : 0));
  const [errors, setErrors] = useState<ArtistApplicationFieldErrors>({});
  const [failedChecks, setFailedChecks] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const firstRender = useRef(true);
  const step = ARTIST_APPLICATION_FORM_STEPS[stepIndex] ?? ARTIST_APPLICATION_FORM_STEPS[0];
  const stepId = step?.id ?? "about";

  // A new step starts at its heading, so keyboard and screen reader users know where they are.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per step change.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = document.getElementById(HEADING_ID);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, [stepIndex]);

  // Unsent changes are protected when the tab closes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = useCallback(
    (update: Partial<ArtistApplicationFormState>) => {
      setForm((current) => ({ ...current, ...update }));
      setDirty(true);
      if (notice?.tone === "saved") setNotice(null);
    },
    [notice],
  );

  /** After a failed check, each fixed field clears its own error as the artist types. */
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    const now = stepErrors(form, stepId, new Date());
    setErrors((current) => {
      const kept = Object.fromEntries(Object.entries(current).filter(([field]) => field in now));
      return Object.keys(kept).length === Object.keys(current).length ? current : kept;
    });
  }, [form, stepId, errors]);

  const apply = useCallback((result: ArtistApplicationActionResult): MyArtistApplication | null => {
    if (result.ok) {
      setRecord({ id: result.application.id, version: result.application.version });
      setDirty(false);
      return result.application;
    }
    setNotice({ tone: "error", message: result.message });
    return null;
  }, []);

  /** Saves every answer; the saved application, or null when the save failed (and why is shown). */
  const save = useCallback(
    async (answers: ArtistApplicationFormState = form): Promise<MyArtistApplication | null> => {
      setPending(true);
      setNotice(null);
      const result = await saveArtistApplication({
        id: record?.id ?? null,
        body: saveBodyFromForm(answers, record?.version ?? 1),
      }).catch(
        (): ArtistApplicationActionResult => ({
          ok: false,
          reason: "unavailable",
          message: "We could not save your application just now. Try again.",
        }),
      );
      setPending(false);
      return apply(result);
    },
    [apply, form, record],
  );

  const goTo = (index: number) => {
    setErrors({});
    setStepIndex(index);
    setReached((current) => Math.max(current, index));
  };

  const check = (id: ArtistApplicationStep): boolean => {
    const found = stepErrors(form, id, new Date());
    setErrors(found);
    if (Object.keys(found).length === 0) return true;
    setFailedChecks((count) => count + 1);
    return false;
  };

  const next = async () => {
    if (!check(stepId)) return;
    if (await save()) goTo(Math.min(stepIndex + 1, STEP_IDS.length - 1));
  };

  const saveForLater = async () => {
    if (await save()) {
      setNotice({
        tone: "saved",
        message: "Saved. You can come back to it from this page at any time.",
      });
    }
  };

  const send = async () => {
    for (const [index, id] of STEP_IDS.entries()) {
      const found = stepErrors(form, id, new Date());
      if (Object.keys(found).length > 0) {
        if (index !== stepIndex) setStepIndex(index);
        setErrors(found);
        setFailedChecks((count) => count + 1);
        return;
      }
    }
    const saved = await save();
    if (!saved) return;
    setPending(true);
    const result = await submitArtistApplication({
      id: saved.id,
      expectedVersion: saved.version,
    }).catch(
      (): ArtistApplicationActionResult => ({
        ok: false,
        reason: "unavailable",
        message: "We could not send your application just now. Try again.",
      }),
    );
    setPending(false);
    if (result.ok) {
      setDirty(false);
      router.push(sentPath);
      router.refresh();
      return;
    }
    if (result.blockers && result.blockers.length > 0) {
      const first = result.blockers[0];
      const index = STEP_IDS.indexOf(first?.step ?? "about");
      setStepIndex(Math.max(0, index));
      setErrors(
        Object.fromEntries(
          result.blockers.filter((b) => b.step === first?.step).map((b) => [b.field, b.message]),
        ),
      );
      setFailedChecks((count) => count + 1);
      return;
    }
    setNotice({ tone: "error", message: result.message });
  };

  const onUploaded = useCallback((updated: MyArtistApplication) => {
    setRecord({ id: updated.id, version: updated.version });
    setForm((current) => mergeServerWorks(current, updated));
  }, []);

  /** A removed work is saved straight away, so its place is free for another image. */
  const removeWork = (index: number) => {
    const answers = { ...form, works: form.works.filter((_, at) => at !== index) };
    setForm(answers);
    if (record) void save(answers);
    else setDirty(true);
  };

  const updateWork = (index: number, update: Partial<ArtistApplicationWorkDraft>) => {
    setForm((current) => ({
      ...current,
      works: current.works.map((work, at) => (at === index ? { ...work, ...update } : work)),
    }));
    setDirty(true);
  };

  const isLast = stepIndex === STEP_IDS.length - 1;
  const nextLabel = ARTIST_APPLICATION_FORM_STEPS[stepIndex + 1]?.label.toLowerCase();
  const done = completedSteps(form, new Date());

  return (
    <div className="flex flex-col gap-10">
      <WizardProgress
        steps={ARTIST_APPLICATION_FORM_STEPS.map(({ id, label }) => ({ id, label }))}
        currentIndex={stepIndex}
        maxReachableIndex={reached}
        completedStepIds={done}
        onStepClick={(index) => goTo(index)}
        stepNavigationDisabled={pending}
        enableMobileSheet
        showUpNext
        className="mb-0"
      />

      <section aria-labelledby={HEADING_ID} className="flex flex-col gap-8">
        <ApplicationStepHeading
          id={HEADING_ID}
          title={step?.title ?? ""}
          intro={step?.intro ?? ""}
        />

        <MarketingFormErrorSummary
          errors={Object.entries(errors).map(([field, message]) => ({
            fieldId: applicationFieldId(field),
            message,
          }))}
          focusKey={failedChecks}
        />

        {stepId === "about" ? (
          <ApplicationAboutStep value={form} errors={errors} onChange={change} />
        ) : null}
        {stepId === "work" ? (
          <ApplicationWorkStep
            applicationId={record?.id ?? null}
            works={form.works}
            errors={errors}
            onWorkChange={updateWork}
            onRemove={removeWork}
            onUploaded={onUploaded}
          />
        ) : null}
        {stepId === "statement" ? (
          <ApplicationStatementStep value={form} errors={errors} onChange={change} />
        ) : null}
        {stepId === "agreement" ? (
          <ApplicationAgreementStep
            form={form}
            errors={errors}
            onConsentChange={(consentToContact) => change({ consentToContact })}
            onEditStep={(id) => goTo(STEP_IDS.indexOf(id))}
          />
        ) : null}
      </section>

      <WizardNav
        isFirst={stepIndex === 0}
        isLast={isLast}
        onBack={() => goTo(Math.max(0, stepIndex - 1))}
        onNext={() => void next()}
        {...(nextLabel ? { nextStepLabel: nextLabel } : {})}
        pending={pending}
        statusSlot={
          notice ? (
            <p
              role={notice.tone === "error" ? "alert" : "status"}
              className={
                notice.tone === "error"
                  ? "m-0 text-sm font-medium text-error"
                  : "m-0 text-sm text-on-surface-variant"
              }
            >
              {notice.message}
            </p>
          ) : null
        }
        submitSlot={
          <Button
            type="button"
            variant="cta"
            size="lg"
            className="min-h-12 w-full font-label"
            disabled={pending}
            onClick={() => void send()}
            data-testid="artist-application-send"
          >
            {pending ? "Sending…" : "Send application"}
          </Button>
        }
      />

      <div className="-mt-4 flex justify-center">
        <Button
          type="button"
          variant="underline"
          size="inline"
          className="px-2 text-sm font-medium text-on-surface-variant hover:text-on-surface"
          onClick={() => void saveForLater()}
          disabled={pending}
        >
          Save and finish later
        </Button>
      </div>
    </div>
  );
}
