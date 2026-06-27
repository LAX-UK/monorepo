"use client";

import { FormBanner } from "@/components/auth/primitives/form-error";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { UnderlineInput } from "@/components/ui/input";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export type PhoneOtpFormValues = z.infer<typeof otpSchema>;

type PhoneOtpVerifyFormProps = {
  phoneDisplay: string;
  busy: boolean;
  bannerError: string | null;
  resendCooldown: number;
  onVerify: (code: string) => Promise<boolean>;
  onResend: () => void;
  onCancel?: () => void;
};

export function PhoneOtpVerifyForm({
  phoneDisplay,
  busy,
  bannerError,
  resendCooldown,
  onVerify,
  onResend,
  onCancel,
}: PhoneOtpVerifyFormProps) {
  const form = useForm<PhoneOtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  /**
   * Track auto-submit in-flight with a ref so we can disable the submit
   * button synchronously (before the React re-render propagates busy=true),
   * preventing a double-call race when the user clicks "Verify number" in
   * the same tick the useEffect fires.
   */
  const autoSubmitRef = useRef(false);
  const lastAuto = useRef("");
  const code = form.watch("code");

  useEffect(() => {
    if (busy) return;
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) {
      lastAuto.current = "";
      return;
    }
    if (lastAuto.current === c) return;
    lastAuto.current = c;
    autoSubmitRef.current = true;
    let cancelled = false;
    void (async () => {
      const ok = await onVerify(c);
      if (!cancelled && !ok) lastAuto.current = "";
      autoSubmitRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [code, busy, onVerify]);

  const handleManualSubmit = form.handleSubmit(async (values) => {
    // Guard: if an auto-submit is already in flight, skip duplicate call.
    if (autoSubmitRef.current) return;
    await onVerify(values.code);
  });

  const handleResend = () => {
    // Clear auto-submit tracking so the user can re-enter (or re-receive) the same
    // 6-digit code after a resend without the auto-submit de-dupe guard blocking them.
    lastAuto.current = "";
    onResend();
  };

  const isBlocked = busy || autoSubmitRef.current;

  return (
    <div className="space-y-4">
      <FormBanner message={bannerError} />
      <p className="font-body text-sm text-on-surface-variant">
        Enter the 6-digit code sent to{" "}
        <span className="font-medium text-on-surface">{phoneDisplay}</span>.
      </p>
      <Form {...form}>
        <form className="space-y-4" onSubmit={handleManualSubmit} noValidate>
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Verification code</FormLabel>
                <FormControl>
                  <UnderlineInput
                    {...field}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    required
                    maxLength={6}
                    placeholder="123456"
                    aria-describedby="otp-hint"
                  />
                </FormControl>
                <p id="otp-hint" className="sr-only">
                  6-digit numeric code
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <AuthSubmitButton loading={isBlocked} loadingLabel="Verifying…" disabled={isBlocked}>
            Verify number
          </AuthSubmitButton>
        </form>
      </Form>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || resendCooldown > 0}
          onClick={handleResend}
          aria-label={
            resendCooldown > 0 ? `Resend code in ${resendCooldown} seconds` : "Resend code"
          }
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            Change number
          </Button>
        ) : null}
      </div>
    </div>
  );
}
