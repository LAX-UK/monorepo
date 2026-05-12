"use client";

import { BackupCodesDisplay } from "@/components/auth/backup-codes-display";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { useEnableTwoFactorController } from "@/lib/auth/hooks/use-enable-two-factor-controller";
import { parseTotpSecretFromUri } from "@/lib/auth/totp-uri";
import { notify } from "@/lib/ui/notify";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), {
  ssr: false,
  loading: () => (
    <div
      className="mx-auto size-48 animate-pulse rounded-lg bg-surface-container-high"
      aria-hidden
    />
  ),
});

const steps = [
  { id: "password", label: "Password" },
  { id: "qr", label: "Scan" },
  { id: "confirm", label: "Verify" },
  { id: "backup", label: "Save codes" },
] as const;

export function TwoFactorEnableWizard() {
  const router = useRouter();
  const {
    step,
    totpURI,
    backupCodes,
    busy,
    pwdForm,
    confirmForm,
    startEnable,
    verifyEnable,
    goToConfirm,
    resetWizard,
  } = useEnableTwoFactorController();

  const [backupAcknowledged, setBackupAcknowledged] = useState(false);

  useEffect(() => {
    if (step !== "backup" || backupAcknowledged) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step, backupAcknowledged]);

  const secret = totpURI ? parseTotpSecretFromUri(totpURI) : null;

  const stepIndex = steps.findIndex((s) => s.id === step);

  return (
    <Card className="border-outline-variant/15">
      <CardHeader>
        <CardTitle className="text-base">Set up authenticator</CardTitle>
        <CardDescription>
          Use an app such as Google Authenticator, 1Password, or Authy to scan the QR code.
        </CardDescription>
        <ol className="mt-4 flex flex-wrap gap-2" aria-label="Setup steps">
          {steps.map((s, i) => (
            <li key={s.id}>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 font-label text-[10px] uppercase tracking-widest ${
                  i === stepIndex
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant/30 text-on-surface-variant"
                }`}
                aria-current={i === stepIndex ? "step" : undefined}
              >
                {i + 1}. {s.label}
              </span>
            </li>
          ))}
        </ol>
      </CardHeader>
      <CardContent className="space-y-8">
        {step === "password" ? (
          <Form {...pwdForm}>
            <form className="space-y-6" onSubmit={startEnable} noValidate>
              {pwdForm.formState.errors.root ? (
                <p role="alert" className="text-sm text-error">
                  {pwdForm.formState.errors.root.message}
                </p>
              ) : null}
              <FormField
                control={pwdForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                      Current password
                    </FormLabel>
                    <FormControl>
                      <UnderlineInput
                        type="password"
                        autoComplete="current-password"
                        className="w-full border-b-2 border-outline-variant/40 py-3"
                        {...field}
                        disabled={busy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <AuthSubmitButton loading={busy} loadingLabel="Checking…">
                Continue
              </AuthSubmitButton>
            </form>
          </Form>
        ) : null}

        {step === "qr" && totpURI ? (
          <div className="space-y-6">
            <div className="flex justify-center rounded-xl border border-outline-variant/20 bg-white p-4 dark:bg-surface-container-highest">
              <QRCodeSVG value={totpURI} size={192} level="M" includeMargin />
            </div>
            {secret ? (
              <div className="space-y-2">
                <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  Can&apos;t scan? Enter this secret
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="break-all rounded-md bg-surface-container-high px-2 py-1 font-mono text-xs text-on-surface">
                    {secret}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => {
                      void navigator.clipboard.writeText(secret);
                      notify.success("Secret copied");
                    }}
                  >
                    Copy secret
                  </Button>
                </div>
              </div>
            ) : null}
            <Button type="button" variant="primary" className="w-full" onClick={goToConfirm}>
              I&apos;ve added LAX in my app
            </Button>
            <Button
              type="button"
              variant="tertiary"
              className="w-full font-footer-links text-sm"
              onClick={() => {
                resetWizard();
              }}
            >
              Start over
            </Button>
          </div>
        ) : null}

        {step === "confirm" ? (
          <Form {...confirmForm}>
            <form className="space-y-6" onSubmit={verifyEnable} noValidate>
              <FormField
                control={confirmForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                      Enter the 6-digit code
                    </FormLabel>
                    <FormControl>
                      <UnderlineInput
                        {...field}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        aria-label="Authenticator code"
                        className="w-full border-b-2 border-outline-variant/40 py-3 font-mono text-2xl tracking-[0.35em]"
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                          field.onChange(v);
                        }}
                        value={field.value}
                        disabled={busy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <AuthSubmitButton loading={busy} loadingLabel="Verifying…">
                Confirm and enable
              </AuthSubmitButton>
              <Button
                type="button"
                variant="tertiary"
                className="w-full"
                onClick={() => resetWizard()}
              >
                Start over
              </Button>
            </form>
          </Form>
        ) : null}

        {step === "backup" && backupCodes.length > 0 ? (
          <div className="space-y-4">
            <p className="font-body text-sm text-on-surface-variant">
              Save these backup codes before continuing. Each code works once if you lose your
              phone.
            </p>
            <BackupCodesDisplay
              codes={backupCodes}
              requireConfirmation
              disabled={busy}
              onConfirm={() => {
                setBackupAcknowledged(true);
                notify.success("Two-factor authentication is on", {
                  description: "You’ll be asked for a code when you sign in on new devices.",
                });
                router.push("/dashboard/settings/security");
                router.refresh();
              }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
