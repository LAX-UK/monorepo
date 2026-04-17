import { RegisterForm } from "@/components/auth/register-form";
import { DisplayHeading } from "@/components/ui/typography";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Register",
  description: "Create an account to bid on curated fine art auctions.",
};

export default function RegisterPage() {
  return (
    <main id="main-content" className="mx-auto max-w-md px-6 py-24 md:py-32">
      <DisplayHeading as="h1" className="mb-10 text-4xl">
        Register
      </DisplayHeading>
      <Suspense fallback={<p className="animate-pulse text-on-surface-variant">Loading…</p>}>
        <RegisterForm />
      </Suspense>
      <p className="mt-10 text-center font-body text-xs text-on-surface-variant">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          Back to gallery
        </Link>
      </p>
    </main>
  );
}
