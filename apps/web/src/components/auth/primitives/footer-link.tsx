import Link from "next/link";

type AuthFooterLinkProps = {
  prefix: string;
  linkText: string;
  href: string;
};

export function AuthFooterLink({ prefix, linkText, href }: AuthFooterLinkProps) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 font-footer-links text-sm leading-[18px] tracking-[0.16px] text-[#161616]">
      <span>{prefix}</span>
      <Link
        href={href}
        className="font-medium text-brand-900 underline decoration-brand-900 underline-offset-[3px]"
      >
        {linkText}
      </Link>
    </p>
  );
}
