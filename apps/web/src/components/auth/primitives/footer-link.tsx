import { AUTH_FOOTER_LINK } from "@/lib/auth/auth-link-classes";
import Link from "next/link";

type AuthFooterLinkProps = {
  prefix: string;
  linkText: string;
  href: string;
};

export function AuthFooterLink({ prefix, linkText, href }: AuthFooterLinkProps) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 font-footer-links text-sm leading-[18px] tracking-[0.16px] text-on-surface">
      <span>{prefix}</span>
      <Link href={href} className={AUTH_FOOTER_LINK}>
        {linkText}
      </Link>
    </p>
  );
}
