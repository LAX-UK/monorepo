"use client";

import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { PhoneNumberField } from "@/components/forms/phone-number-field";
import {
  POST_AUTH_SESSION_LOAD_ERROR,
  fetchSessionUserWithRetry,
} from "@/lib/auth/fetch-session-user-with-retry.client";
import { postLoginHandoffHref } from "@/lib/auth/post-login-handoff";
import { signInWithPhoneService } from "@/lib/auth/services/phone-verification.service";
import { useRefetchAppSession } from "@/lib/auth/use-refetch-app-session";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem } from "@auction/ui/components/form";
import { normalizePhoneInput, phoneInputSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CountryCode } from "libphonenumber-js";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  phone: phoneInputSchema,
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

type SignInPhoneFormProps = {
  nextHref: string;
  defaultCountry?: CountryCode;
  onUseEmail?: () => void;
  /** Pass to show social sign-in buttons as a fallback above the form. */
  next?: string;
};

export function SignInPhoneForm({
  nextHref,
  defaultCountry = "GB",
  onUseEmail,
  next,
}: SignInPhoneFormProps) {
  const router = useRouter();
  const refetchSession = useRefetchAppSession();
  const [pending, startTransition] = useTransition();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: { country: defaultCountry, number: "" },
      password: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setBannerError(null);
    const normalized = normalizePhoneInput(values.phone);
    if (!normalized.ok) {
      form.setError("phone.number", { message: normalized.message });
      return;
    }
    startTransition(async () => {
      const result = await signInWithPhoneService({
        phoneE164: normalized.value.e164,
        password: values.password,
      });
      if (!result.ok) {
        // Unverified number gets a dedicated actionable prompt instead of a plain error.
        if (result.message === "phone_number_not_verified") {
          setShowVerifyPrompt(true);
          setBannerError(null);
        } else {
          setBannerError(result.message);
          notify.error(result.message);
        }
        return;
      }
      if (result.requiresTwoFactor) {
        router.push(`/login/two-factor?next=${encodeURIComponent(nextHref)}`);
        return;
      }
      await refetchSession();
      const me = await fetchSessionUserWithRetry();
      if (!me) {
        setBannerError(POST_AUTH_SESSION_LOAD_ERROR);
        notify.error(POST_AUTH_SESSION_LOAD_ERROR);
        return;
      }
      router.push(postLoginHandoffHref(nextHref, { withWelcomeBack: true }));
      router.refresh();
    });
  });

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Heading + helper text */}
      <div className="space-y-1">
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          Sign in with phone number
        </h2>
        <p className="font-body text-sm text-on-surface-variant">
          Use the mobile number on your account and your password.
        </p>
      </div>

      {/* Actionable prompt when the number exists but isn't verified yet */}
      {showVerifyPrompt ? (
        <div
          role="alert"
          className="rounded-lg border border-warning/40 bg-warning-container/20 px-4 py-3 space-y-3"
        >
          <p className="font-body text-sm font-medium text-on-surface">
            This number hasn&apos;t been verified yet.
          </p>
          <p className="font-body text-sm text-on-surface-variant">
            Sign in with your email or social account first, then verify your number in profile
            settings to enable phone sign-in.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {onUseEmail ? (
              <Button
                type="button"
                variant="link"
                size="link"
                className="font-label text-sm font-semibold text-on-surface"
                onClick={onUseEmail}
              >
                Sign in with email instead
              </Button>
            ) : null}
            <Button
              type="button"
              variant="link"
              size="link"
              className="font-footer-links text-sm text-on-surface-variant"
              onClick={() => setShowVerifyPrompt(false)}
            >
              Try a different number
            </Button>
          </div>
          {next ? (
            <div className="pt-1">
              <SocialSignInButtons next={next} />
            </div>
          ) : null}
        </div>
      ) : (
        <FormBanner message={bannerError} />
      )}
      <Form {...form}>
        <form
          onSubmit={onSubmit}
          className={`flex flex-col gap-6${showVerifyPrompt ? " hidden" : ""}`}
          noValidate
          // inert removes fields from tab order AND accessibility tree when hidden.
          // aria-hidden alone leaves inputs keyboard-reachable via Tab.
          {...(showVerifyPrompt ? { inert: true } : {})}
        >
          <FormField
            control={form.control}
            name="phone"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormControl>
                  <PhoneNumberField
                    id="sign-in-phone"
                    variant="auth"
                    defaultCountry={defaultCountry}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message ?? null}
                    label="Phone number"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <RHFPasswordField
            control={form.control}
            name="password"
            label="Password"
            autoComplete="current-password"
          />
          <AuthSubmitButton loading={pending} loadingLabel="Signing in…">
            Sign in with phone
          </AuthSubmitButton>
        </form>
      </Form>
      {onUseEmail ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 text-on-surface-variant" aria-hidden>
            <span className="h-px flex-1 bg-outline-variant/40" />
            <span className="font-footer-links text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
              or
            </span>
            <span className="h-px flex-1 bg-outline-variant/40" />
          </div>
          {next ? <SocialSignInButtons next={next} /> : null}
          <Button
            type="button"
            variant="link"
            size="link"
            className="font-footer-links text-sm"
            onClick={onUseEmail}
          >
            Sign in with email instead
          </Button>
        </div>
      ) : null}
    </div>
  );
}
