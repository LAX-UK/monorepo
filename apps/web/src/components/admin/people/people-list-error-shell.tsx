"use client";

import { AdminListShell } from "@/components/admin/admin-list-shell";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  backHref: string;
  backLabel: string;
  message?: string;
  reset?: () => void;
  children?: ReactNode;
};

/** Error recovery inside PeopleListShell for people-module list routes. */
export function PeopleListErrorShell({
  title,
  backHref,
  backLabel,
  message = "Something went wrong loading this page. Try again or return to the list.",
  reset,
  children,
}: Props) {
  return (
    <AdminListShell
      title={title}
      description="Error"
      view={
        <div className="flex flex-col items-start gap-4 rounded-lg border border-border-hairline bg-surface-container-low/30 p-6">
          <h2 className="font-headline text-lg text-on-surface">
            Could not load {title.toLowerCase()}
          </h2>
          <p className="font-body text-sm text-on-surface-variant">{message}</p>
          <div className="flex flex-wrap gap-2">
            {reset ? (
              <Button type="button" variant="default" onClick={reset}>
                Try again
              </Button>
            ) : null}
            <Button variant="secondary" asChild>
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          </div>
          {children}
        </div>
      }
    />
  );
}
