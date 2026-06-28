"use client";

import { useResendCooldown } from "@/lib/auth/hooks/use-resend-cooldown";
import {
  removePhoneNumberService,
  sendPhoneOtpService,
  verifyPhoneOtpService,
} from "@/lib/auth/services/phone-verification.service";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { notify } from "@/lib/ui/notify";
import { normalizePhoneInput } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CountryCode } from "libphonenumber-js";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  type ProfilePhoneFormValues,
  profilePhoneFormSchema,
  splitE164ForForm,
} from "./profile-settings-schema";

export type ProfileMobileController = FormController<ProfilePhoneFormValues> & {
  step: "phone" | "otp";
  initialVerified: boolean;
  pendingE164: string | null;
  pendingDisplay: string | null;
  otpError: string | null;
  resendCooldown: number;
  verifyOtp: (code: string) => Promise<boolean>;
  resendOtp: () => void;
  cancelOtp: () => void;
};

/** Format an E.164 string for display in the OTP prompt (e.g. "+44 7700 900123"). */
function formatPhoneForDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.formatInternational() ?? e164;
}

export function useProfileMobileController(
  initialMobile: string | null,
  initialMobileCountry: string | null,
  defaultCountry: CountryCode,
  initialVerified = false,
): ProfileMobileController {
  const [pending, startTransition] = useTransition();
  const [otpPending, setOtpPending] = useState(false);
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [pendingE164, setPendingE164] = useState<string | null>(null);
  const [pendingDisplay, setPendingDisplay] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  // 45s initial cooldown (Twilio recommends minimum 30s; 45s reduces toll-fraud risk).
  const { remaining: resendCooldown, start: startCooldown } = useResendCooldown(45);

  const form = useForm<ProfilePhoneFormValues>({
    resolver: zodResolver(profilePhoneFormSchema),
    defaultValues: {
      phone: splitE164ForForm(
        initialMobile,
        defaultCountry,
        initialMobileCountry ?? defaultCountry,
      ),
    },
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const trimmed = values.phone.number.trim();
      if (trimmed.length === 0) {
        const r = await removePhoneNumberService();
        if (r.ok) {
          notify.success("Phone number removed");
          form.reset({ phone: { country: defaultCountry, number: "" } });
          router.refresh();
          return;
        }
        notify.error(r.message);
        return;
      }

      const normalized = normalizePhoneInput(values.phone);
      if (!normalized.ok) {
        form.setError("phone.number", { message: normalized.message });
        return;
      }

      const send = await sendPhoneOtpService(normalized.value.e164);
      if (!send.ok) {
        notify.error(send.message);
        return;
      }

      setPendingE164(normalized.value.e164);
      // Show the internationally formatted number so the user can confirm it is correct.
      setPendingDisplay(formatPhoneForDisplay(normalized.value.e164));
      setOtpError(null);
      setStep("otp");
      startCooldown();
      notify.success("Verification code sent");
    });
  });

  const verifyOtp = useCallback(
    async (code: string) => {
      if (!pendingE164) return false;
      setOtpPending(true);
      setOtpError(null);
      try {
        const r = await verifyPhoneOtpService({
          phoneE164: pendingE164,
          code,
          updatePhoneNumber: true,
        });
        if (!r.ok) {
          setOtpError(r.message);
          notify.error(r.message);
          return false;
        }
        notify.success("Phone number verified");
        setStep("phone");
        setPendingE164(null);
        setPendingDisplay(null);
        router.refresh();
        return true;
      } finally {
        setOtpPending(false);
      }
    },
    [pendingE164, router],
  );

  const resendOtp = useCallback(() => {
    if (!pendingE164 || resendCooldown > 0) return;
    void (async () => {
      const r = await sendPhoneOtpService(pendingE164);
      if (!r.ok) {
        notify.error(r.message);
        return;
      }
      startCooldown();
      notify.success("Verification code sent");
    })();
  }, [pendingE164, resendCooldown, startCooldown]);

  const cancelOtp = useCallback(() => {
    setStep("phone");
    setPendingE164(null);
    setPendingDisplay(null);
    setOtpError(null);
  }, []);

  return {
    form,
    onSubmit,
    isSubmitting: pending || otpPending || form.formState.isSubmitting,
    initialVerified,
    error: null,
    step,
    pendingE164,
    pendingDisplay,
    otpError,
    resendCooldown,
    verifyOtp,
    resendOtp,
    cancelOtp,
  };
}
