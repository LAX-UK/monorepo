"use client";

import type * as React from "react";
import { cn } from "../../lib/utils.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.js";

export type ReviewSplitPaneProps = {
  recordTitle: string;
  decisionTitle: string;
  record: React.ReactNode;
  decision: React.ReactNode;
  /** Optional sticky action above tabs on mobile (e.g. Next in queue) */
  mobileStickyAction?: React.ReactNode;
  className?: string;
};

/**
 * Two columns lg+; Record / Decision tabs below lg.
 */
export function ReviewSplitPane({
  recordTitle,
  decisionTitle,
  record,
  decision,
  mobileStickyAction,
  className,
}: ReviewSplitPaneProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="hidden gap-8 lg:grid lg:grid-cols-2">
        <section aria-labelledby="review-record-heading" className="min-w-0 space-y-4">
          <h2
            id="review-record-heading"
            className="font-label text-xs font-bold uppercase tracking-widest text-secondary"
          >
            {recordTitle}
          </h2>
          {record}
        </section>
        <section aria-labelledby="review-decision-heading" className="min-w-0 space-y-4">
          <h2
            id="review-decision-heading"
            className="font-label text-xs font-bold uppercase tracking-widest text-secondary"
          >
            {decisionTitle}
          </h2>
          {decision}
        </section>
      </div>

      <div className="lg:hidden">
        {mobileStickyAction ? (
          <div className="mb-3 border-b border-outline-variant/15 pb-3">{mobileStickyAction}</div>
        ) : null}
        <Tabs defaultValue="record" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="record" className="min-h-11">
              {recordTitle}
            </TabsTrigger>
            <TabsTrigger value="decision" className="min-h-11">
              {decisionTitle}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="record" className="min-h-[12rem]">
            {record}
          </TabsContent>
          <TabsContent value="decision" className="min-h-[12rem]">
            {decision}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
