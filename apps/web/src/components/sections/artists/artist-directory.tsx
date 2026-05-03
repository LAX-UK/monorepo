"use client";

import { artistEyebrowText } from "@/lib/artists/display";
import { ALPHABET_LETTERS, filterArtistsDirectory, lettersPresent } from "@/lib/artists/filter";
import type { ArtistProfile } from "@/lib/data/contracts";
import { artistPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { ChevronDown, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

const PAGE_SIZE = 6;

function staggerClass(index: number): string {
  switch (index % 6) {
    case 1:
      return "mt-12 md:mt-0 lg:mt-24";
    case 2:
      return "mt-12 md:mt-24 lg:mt-0";
    case 4:
      return "lg:mt-24";
    case 5:
      return "mt-12 md:mt-24 lg:mt-0";
    default:
      return "";
  }
}

type Props = {
  artists: ArtistProfile[];
};

export function ArtistDirectory({ artists }: Props) {
  const [letter, setLetter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const presentLetters = useMemo(() => lettersPresent(artists), [artists]);

  const filtered = useMemo(
    () => filterArtistsDirectory(artists, letter, query),
    [artists, letter, query],
  );

  const visible = filtered.slice(0, visibleCount);
  const canLoadMore = visibleCount < filtered.length;

  return (
    <>
      <div className="sticky top-20 z-40 border-y border-outline-variant/10 bg-surface/90 px-8 py-4 backdrop-blur-md md:px-20">
        <div className="no-scrollbar mx-auto flex max-w-[1920px] items-center justify-between gap-6 overflow-x-auto">
          <div className="flex min-w-max items-center gap-4 md:gap-6">
            <span className="mr-4 shrink-0 font-label text-xs font-bold uppercase tracking-widest text-on-surface">
              Filter by
            </span>
            <div className="flex gap-4 md:gap-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLetter("ALL");
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`h-auto shrink-0 rounded-none px-0 py-0 text-xs font-medium hover:bg-transparent ${
                  letter === "ALL"
                    ? "font-bold text-primary"
                    : "text-on-secondary-container hover:text-primary"
                }`}
              >
                ALL
              </Button>
              {ALPHABET_LETTERS.map((L) => {
                const has = presentLetters.has(L);
                const active = letter === L;
                return (
                  <Button
                    key={L}
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!has}
                    onClick={() => {
                      if (!has) return;
                      setLetter(L);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    className={`h-auto shrink-0 rounded-none px-0 py-0 text-xs font-medium hover:bg-transparent ${
                      !has
                        ? "cursor-default text-stone-300 dark:text-stone-600"
                        : active
                          ? "border-b border-primary font-bold text-primary"
                          : "text-on-secondary-container hover:text-primary"
                    }`}
                  >
                    {L}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Search className="size-4 text-outline" aria-hidden />
            <label htmlFor="artist-search" className="sr-only">
              Search artists
            </label>
            <Input
              id="artist-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="h-auto w-36 border-none bg-transparent px-0 py-0 font-body text-xs tracking-wider shadow-none placeholder:text-outline-variant focus-visible:ring-0 md:w-44"
              placeholder="Search artists..."
              type="search"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      <section className="bg-surface-container-lowest px-8 py-24 md:px-20">
        <div className="mx-auto grid max-w-[1920px] grid-cols-1 gap-x-12 gap-y-24 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((a, index) => {
            const eyebrow = artistEyebrowText(a);
            return (
              <Link
                key={a.id}
                href={artistPath(a)}
                className={`group block ${staggerClass(index)}`}
              >
                <div className="relative mb-6 aspect-4/5 overflow-hidden bg-surface-container">
                  <Image
                    src={a.portraitUrl}
                    alt={`${a.name} — artist portrait`}
                    fill
                    className="object-cover grayscale transition-all duration-700 motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100 group-hover:grayscale-0"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <div className="flex flex-col">
                  {eyebrow ? (
                    <span className="mb-2 font-label text-xs uppercase tracking-[0.3em] text-primary">
                      {eyebrow}
                    </span>
                  ) : null}
                  <h3 className="mb-3 font-headline text-3xl text-on-surface transition-colors group-hover:text-primary">
                    {a.name}
                  </h3>
                  <p className="line-clamp-2 font-body text-sm leading-relaxed text-secondary">
                    {a.tagline}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-16 text-center font-body text-sm text-on-surface-variant">
            No artists match this filter. Try another letter or search term.
          </p>
        ) : null}

        {canLoadMore ? (
          <div className="mt-32 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="group h-auto gap-4 rounded-none px-0 py-0 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-surface hover:bg-transparent hover:text-primary"
            >
              <span>Load more artists</span>
              <ChevronDown className="transition-transform group-hover:translate-y-1" aria-hidden />
            </Button>
          </div>
        ) : null}
      </section>
    </>
  );
}
