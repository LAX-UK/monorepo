import type { AuthorisationLineVm, BuyerAgentBannerVm } from "@/lib/bid/buyer-agent-banner";
import { Notice } from "@auction/ui/lax";

/** How much of a total is in use, as a quiet bar under the sentence that says it. */
function UsageBar({ line }: { line: AuthorisationLineVm }) {
  if (!line.usage) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      <p>{line.usage.text}</p>
      <div
        role="meter"
        aria-label="Total used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={line.usage.percent}
        className="h-1.5 w-full max-w-72 overflow-hidden rounded-full bg-lax-neutral-bg"
      >
        <div
          className="h-full rounded-full bg-lax-ink"
          style={{ width: `${line.usage.percent}%` }}
        />
      </div>
    </div>
  );
}

/**
 * A buyer agent's authority above their bids: where they may bid for the organisation and up to
 * how much, with what is used of their total; or, with no authorisation, who can give one.
 */
export function BuyerAgentBanner({ banner }: { banner: BuyerAgentBannerVm }) {
  if (banner.kind === "not-authorised") {
    return (
      <Notice tone="warning" title={`You can't bid for ${banner.organisation} yet.`}>
        Ask an owner or admin to authorise you to bid, for one sale or for every sale.
      </Notice>
    );
  }
  const [only] = banner.lines;
  if (banner.lines.length === 1 && only) {
    return (
      <Notice title={`You can bid for ${banner.organisation} ${only.text}.`}>
        <UsageBar line={only} />
      </Notice>
    );
  }
  return (
    <Notice title={`You can bid for ${banner.organisation}:`}>
      <ul className="mt-1 flex flex-col gap-3">
        {banner.lines.map((line) => (
          <li key={line.key}>
            <span>
              {line.text.charAt(0).toUpperCase()}
              {line.text.slice(1)}.
            </span>
            <UsageBar line={line} />
          </li>
        ))}
      </ul>
    </Notice>
  );
}
