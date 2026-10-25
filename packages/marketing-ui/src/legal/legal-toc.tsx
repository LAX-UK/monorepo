"use client";

import { cn } from "@auction/ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@auction/ui/components/accordion";
import { useEffect, useState } from "react";

export type LegalTocItem = { id: string; label: string };

/** Distance below the viewport top at which a section counts as the one being read. */
const READING_LINE_PX = 160;

/** Tracks the section the reader is in: the last heading that has crossed the reading line. */
function useCurrentSection(ids: readonly string[]): string | null {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let next: string | null = null;
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= READING_LINE_PX) next = id;
      }
      setCurrent(next ?? ids[0] ?? null);
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [ids]);

  return current;
}

function TocList({
  items,
  current,
  onNavigate,
}: {
  items: readonly LegalTocItem[];
  current: string | null;
  onNavigate?: () => void;
}) {
  return (
    <ol className="lax-legal-toc__list">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="lax-legal-toc__link"
            aria-current={item.id === current ? "location" : undefined}
            onClick={onNavigate}
          >
            {item.label}
          </a>
        </li>
      ))}
    </ol>
  );
}

export type LegalTocProps = {
  items: readonly LegalTocItem[];
  className?: string;
};

/**
 * "On this page": a sticky list beside the text on wide screens, a collapsible list above it on
 * narrow ones. The section being read is marked `aria-current="location"` and highlighted.
 */
export function LegalToc({ items, className }: LegalTocProps) {
  const [ids] = useState(() => items.map((item) => item.id));
  const current = useCurrentSection(ids);
  const [open, setOpen] = useState<string>("");

  if (items.length === 0) return null;

  return (
    <>
      <nav aria-label="On this page" className={cn("lax-legal-toc lax-legal-toc--rail", className)}>
        <p className="lax-legal-toc__heading">On this page</p>
        <TocList items={items} current={current} />
      </nav>
      <div className={cn("lax-legal-toc lax-legal-toc--collapsible", className)}>
        <Accordion type="single" collapsible value={open} onValueChange={setOpen}>
          <AccordionItem value="toc" className="lax-legal-toc__panel">
            <AccordionTrigger className="lax-legal-toc__trigger">On this page</AccordionTrigger>
            <AccordionContent>
              <nav aria-label="On this page" className="lax-legal-toc__collapsible-nav">
                <TocList items={items} current={current} onNavigate={() => setOpen("")} />
              </nav>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
