import type { ReactNode } from "react";

type Props = {
  title: string;
  kicker?: string;
  children: ReactNode;
};

export function LegalPage({ title, kicker = "The Digital Curator", children }: Props) {
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-6 pb-24 pt-28 md:px-10 lg:pt-32">
      <p className="mb-3 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
        {kicker}
      </p>
      <h1 className="mb-10 font-headline text-4xl tracking-tight text-on-surface md:text-5xl">
        {title}
      </h1>
      <div className="space-y-6 font-body text-sm leading-relaxed text-on-surface-variant md:text-base">
        {children}
      </div>
    </main>
  );
}
