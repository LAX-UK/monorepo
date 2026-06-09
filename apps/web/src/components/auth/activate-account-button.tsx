"use client";

import { buildMagicLinkVerifyUrl } from "@/lib/auth/magic-link-verify-url";
import { getSiteUrl } from "@/lib/site-url";
import { Button } from "@auction/ui/components/button";

export function ActivateAccountButton({ token }: { token: string }) {
  const href = buildMagicLinkVerifyUrl(token, getSiteUrl());

  return (
    <Button asChild variant="cta" size="xl" className="font-headline shadow-none">
      <a href={href}>Continue</a>
    </Button>
  );
}
