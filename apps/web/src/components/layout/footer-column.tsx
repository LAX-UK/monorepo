import Link from "next/link";

export type FooterLink = { href: string; label: string };

type FooterColumnProps = {
  title: string;
  links: FooterLink[];
  linkClassName: string;
  headingClassName: string;
};

export function FooterColumn({ title, links, linkClassName, headingClassName }: FooterColumnProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className={headingClassName}>{title}</h2>
      <ul className="flex flex-col gap-4">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className={linkClassName}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
