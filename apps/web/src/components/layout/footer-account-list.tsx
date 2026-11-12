"use client";

import { bidFooterAccountLinks } from "@/components/layout/footer-account-links";
import { FooterLink } from "@/components/layout/footer-link";
import { useAppSession } from "@/lib/auth/use-app-session";

/**
 * The footer's Account list. It follows the session, which can change without the page reloading
 * (signing in or out in another tab), so it is the one part of the footer drawn in the browser.
 */
export function FooterAccountList() {
  const { user } = useAppSession();
  return (
    <ul className="flex flex-col gap-3">
      {bidFooterAccountLinks(user).map((link) => (
        <li key={link.href}>
          <FooterLink link={link} />
        </li>
      ))}
    </ul>
  );
}
