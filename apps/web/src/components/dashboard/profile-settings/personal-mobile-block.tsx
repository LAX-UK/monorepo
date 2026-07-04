"use client";

import { PhoneOtpVerifyForm } from "@/components/auth/phone-otp-verify-form";
import { PhoneNumberField } from "@/components/forms/phone-number-field";
import { removePhoneNumberService } from "@/lib/auth/services/phone-verification.service";
import { useProfileMobileController } from "@/lib/forms/profile/use-profile-mobile-controller";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Form, FormField } from "@auction/ui/components/form";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function PersonalMobileBlock({
  initialMobile,
  initialMobileCountry,
  phoneDefaultCountry,
  phoneNumberVerified = false,
}: {
  initialMobile: string | null;
  initialMobileCountry: string | null;
  phoneDefaultCountry: string;
  phoneNumberVerified?: boolean;
}) {
  const router = useRouter();
  const {
    form,
    onSubmit,
    isSubmitting,
    step,
    pendingDisplay,
    otpError,
    resendCooldown,
    verifyOtp,
    resendOtp,
    cancelOtp,
    initialVerified,
  } = useProfileMobileController(
    initialMobile,
    initialMobileCountry,
    phoneDefaultCountry as import("libphonenumber-js").CountryCode,
    phoneNumberVerified,
  );
  const [removePending, startRemove] = useTransition();

  if (step === "otp" && pendingDisplay) {
    return (
      <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6">
        <PhoneOtpVerifyForm
          phoneDisplay={pendingDisplay}
          busy={isSubmitting}
          bannerError={otpError}
          resendCooldown={resendCooldown}
          onVerify={verifyOtp}
          onResend={resendOtp}
          onCancel={cancelOtp}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {initialMobile?.trim() ? (
          <StatusBadge variant={initialVerified ? "success" : "warning"} size="sm">
            {initialVerified ? "Verified" : "Unverified"}
          </StatusBadge>
        ) : null}
      </div>
      <Form {...form}>
        <form id="profile-mobile-form" onSubmit={onSubmit} className="space-y-3">
          <FormField
            control={form.control}
            name="phone"
            render={({ field, fieldState }) => (
              <PhoneNumberField
                id="profile-phone"
                defaultCountry={phoneDefaultCountry as import("libphonenumber-js").CountryCode}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message ?? null}
                description={
                  initialMobile?.trim() && !initialVerified
                    ? "Verify your number to sign in with it and to use telephone bidding. We will send a one-time code by SMS."
                    : "Optional contact number for live bidding updates and fulfilment. Adding or changing your number requires SMS verification."
                }
              />
            )}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="secondaryOutline"
              disabled={isSubmitting || removePending}
              className="min-w-28"
            >
              {isSubmitting
                ? initialMobile?.trim() && !initialVerified
                  ? "Sending code…"
                  : "Saving…"
                : initialMobile?.trim() && !initialVerified
                  ? "Send verification code"
                  : "Save"}
            </Button>
            {initialMobile ? (
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting || removePending}
                onClick={() => {
                  startRemove(async () => {
                    const r = await removePhoneNumberService();
                    if (r.ok) {
                      notify.success("Phone number removed");
                      form.reset({
                        phone: { country: phoneDefaultCountry, number: "" },
                      });
                      router.refresh();
                      return;
                    }
                    notify.error(r.message);
                  });
                }}
              >
                {removePending ? "Removing…" : "Remove"}
              </Button>
            ) : null}
          </div>
        </form>
      </Form>
    </div>
  );
}
