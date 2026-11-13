"use client";

import {
  type FinanceNoticeContent,
  SELLER_RULE_TEXT,
} from "@/lib/admin/seller-proceeds/finance-notice";
import { Notice, StaffButton } from "@auction/staff-ui";
import { useId, useState } from "react";

/**
 * The one-time notice about how seller payouts now work, at the top of Finance overview and the
 * Settlement run. It is part of the page, never a modal; each person dismisses it for themselves.
 */
export function FinanceRuleNotice({
  content,
  dismissCookie,
  initiallyOpen = false,
}: {
  content: FinanceNoticeContent;
  /** The cookie "Got it" writes for this person. */
  dismissCookie: string;
  /** For the review route: show the rule expanded. */
  initiallyOpen?: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(initiallyOpen);
  const ruleId = useId();
  if (hidden) return null;
  return (
    <Notice
      tone="info"
      title={content.title}
      actions={
        <>
          <StaffButton
            size="sm"
            variant="secondary"
            aria-expanded={ruleOpen}
            aria-controls={ruleId}
            onClick={() => setRuleOpen((open) => !open)}
          >
            {content.readRule}
          </StaffButton>
          <StaffButton
            size="sm"
            variant="primary"
            onClick={() => {
              document.cookie = dismissCookie;
              setHidden(true);
            }}
          >
            {content.dismiss}
          </StaffButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p>{content.since}</p>
        <dl className="grid gap-3 md:grid-cols-3">
          {content.sections.map((section) => (
            <div key={section.heading} className="flex flex-col gap-0.5">
              <dt className="font-medium">{section.heading}</dt>
              <dd>{section.body}</dd>
            </div>
          ))}
        </dl>
        {ruleOpen ? (
          <ol id={ruleId} className="flex list-decimal flex-col gap-1 pl-5">
            {SELLER_RULE_TEXT.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        ) : null}
      </div>
    </Notice>
  );
}
