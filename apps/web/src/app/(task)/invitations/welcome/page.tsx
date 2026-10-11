import { AuthLayout } from "@/components/auth/auth-layout";
import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { loadStaffAccessLaunchLinks } from "@/lib/invitations/staff-access-launch.server";
import { parseWelcomePlatforms } from "@/lib/invitations/welcome-platforms";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Button } from "@auction/ui/components/button";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Your LAX access",
  "Open the London Art Exchange platforms you now have access to.",
);

export default async function StaffAccessWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ platforms?: string | string[] }>;
}) {
  const { platforms } = await searchParams;
  const products = parseWelcomePlatforms(platforms);
  const query = products.length > 0 ? `?platforms=${products.join(",")}` : "";
  // Staff and clients both land here, so no shell guard (which would send staff to /admin).
  if (!(await getServerSessionUser())) {
    redirect(buildHostedLoginStartHref({ next: `/invitations/welcome${query}` }));
  }
  const links = loadStaffAccessLaunchLinks(products);

  return (
    <main id="main-content">
      <AuthLayout
        chrome="task"
        title={links.length > 0 ? "You now have access" : "Invitation accepted"}
        description="Your LAX account now works on these platforms. Sign-in carries over between them."
      >
        <ul className="m-0 grid list-none gap-3 p-0">
          {links.map((link) => (
            <li
              key={link.product}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-soft bg-surface-container-lowest p-4"
            >
              <div className="min-w-0">
                <p className="font-body text-sm font-semibold text-on-surface">{link.label}</p>
                <p className="font-body text-xs text-on-surface-variant">{link.description}</p>
              </div>
              <Button
                asChild
                variant={link.product === products[0] ? "cta" : "outline"}
                className="min-h-11"
              >
                {link.external ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.cta}
                    <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                ) : (
                  <Link href={link.href}>{link.cta}</Link>
                )}
              </Button>
            </li>
          ))}
        </ul>
        {links.length === 0 ? (
          <Button asChild variant="cta" className="mt-2 min-h-11 w-full">
            <Link href="/dashboard">Continue</Link>
          </Button>
        ) : null}
      </AuthLayout>
    </main>
  );
}
