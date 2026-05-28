"use client";

import { FormBanner } from "@/components/auth/primitives/form-error";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { UnderlineInput } from "@/components/ui/input";
import { useVerifyTotpController } from "@/lib/auth/hooks/use-verify-totp-controller";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Label } from "@auction/ui/components/label";
import { useEffect, useRef } from "react";

type TwoFactorVerifyFormProps = {
  nextHref: string;
};

export function TwoFactorVerifyForm({ nextHref }: TwoFactorVerifyFormProps) {
  const {
    mode,
    setMode,
    trustDevice,
    setTrustDevice,
    busy,
    totpForm,
    backupForm,
    submitTotp,
    submitBackup,
    bannerError,
  } = useVerifyTotpController(nextHref);

  const lastAutoTotp = useRef<string>("");
  const totpCode = totpForm.watch("code");
  useEffect(() => {
    if (mode !== "totp" || busy) return;
    const c = totpCode.replace(/\D/g, "");
    if (c.length !== 6) {
      lastAutoTotp.current = "";
      return;
    }
    if (lastAutoTotp.current === c) return;
    lastAutoTotp.current = c;
    let cancelled = false;
    void (async () => {
      const ok = await submitTotp(c);
      if (!cancelled && !ok) {
        lastAutoTotp.current = "";
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [totpCode, mode, busy, submitTotp]);

  return (
    <div className="flex w-full flex-col gap-8">
      <FormBanner message={bannerError} />
      <div className="flex items-center gap-3 rounded-lg border border-border-hairline bg-surface-container-low/50 px-3 py-2">
        <Checkbox
          id="trust-device"
          checked={trustDevice}
          onCheckedChange={(v) => setTrustDevice(v === true)}
          disabled={busy}
        />
        <Label htmlFor="trust-device" className="cursor-pointer font-body text-sm text-on-surface">
          Trust this device for 30 days
        </Label>
      </div>

      {mode === "totp" ? (
        <Form {...totpForm}>
          <form
            className="space-y-6"
            onSubmit={totpForm.handleSubmit(async (v) => {
              await submitTotp(v.code);
            })}
            noValidate
          >
            <FormField
              control={totpForm.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
                    Authenticator code
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput
                      {...field}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      pattern="[0-9]*"
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
              Verify and continue
            </AuthSubmitButton>
          </form>
        </Form>
      ) : (
        <Form {...backupForm}>
          <form
            className="space-y-6"
            onSubmit={backupForm.handleSubmit(async (v) => {
              await submitBackup(v.code.trim());
            })}
            noValidate
          >
            <FormField
              control={backupForm.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
                    Backup code
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput
                      {...field}
                      autoComplete="off"
                      aria-label="Backup recovery code"
                      className="w-full border-b-2 border-outline-variant/40 py-3 font-mono text-base"
                      disabled={busy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <AuthSubmitButton loading={busy} loadingLabel="Verifying…">
              Verify backup code
            </AuthSubmitButton>
          </form>
        </Form>
      )}

      <div className="text-center">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 rounded-none px-3 font-footer-links text-sm font-normal text-primary underline-offset-2 hover:bg-transparent hover:underline hover:text-primary"
          onClick={() => {
            setMode(mode === "totp" ? "backup" : "totp");
            totpForm.reset();
            backupForm.reset();
            lastAutoTotp.current = "";
          }}
          disabled={busy}
        >
          {mode === "totp" ? "Use a backup code instead" : "Use authenticator code instead"}
        </Button>
      </div>
    </div>
  );
}
