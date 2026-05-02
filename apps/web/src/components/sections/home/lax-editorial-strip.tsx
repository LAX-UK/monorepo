import { BodyText } from "@auction/ui";
import Link from "next/link";

const items = [
  {
    num: "01",
    title: "How to Bid",
    body: "Register your details, receive approval, and place bids from anywhere in the world — online, by phone, or in-room.",
    href: "/faq",
  },
  {
    num: "02",
    title: "Submit a Work",
    body: "Our specialists review every consignment with care. Submit your item details and receive an estimate within 5 business days.",
    href: "/contact",
  },
  {
    num: "03",
    title: "Meet the Artists",
    body: "We work with artists whose practice speaks to the moment. Browse profiles, past results, and upcoming lots.",
    href: "/artist/featured",
  },
] as const;

export function LaxEditorialStrip() {
  return (
    <section className="border-y border-outline-variant bg-surface-container-lowest px-6 py-16 dark:bg-surface-container-low md:px-10 lg:px-14">
      <div className="mx-auto grid max-w-[var(--container-inner,1376px)] grid-cols-1 gap-10 md:grid-cols-3 md:gap-14">
        {items.map((item) => (
          <div key={item.num} className="flex flex-col gap-4">
            <span className="font-artists-serif text-xs font-light tracking-[0.1em] text-primary">
              {item.num}
            </span>
            <h3 className="font-headline text-lg font-semibold text-on-surface">{item.title}</h3>
            <BodyText className="text-sm leading-7 text-on-surface-variant">{item.body}</BodyText>
            <Link
              href={item.href}
              className="w-fit border-b border-transparent pb-0.5 font-label text-xs font-semibold uppercase tracking-[0.06em] text-primary transition-colors hover:border-primary"
            >
              Learn more →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
