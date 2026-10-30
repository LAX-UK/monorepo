"use client";

import { Button } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { HomePanel, HomeSection } from "./home-section";

/** The figures could not be loaded: say so where they would be, with a way to try again. */
export function HomeFiguresUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <HomeSection id="home-at-a-glance" title="At a glance">
      <HomePanel className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <output className="text-lax-14 text-lax-fg">
          We couldn't load the figures just now. Everything else on Home is up to date.
        </output>
        <Button
          variant="secondary"
          loading={pending}
          className="h-11 sm:h-lax-control-md"
          onClick={() => startTransition(() => router.refresh())}
        >
          Try again
        </Button>
      </HomePanel>
    </HomeSection>
  );
}
