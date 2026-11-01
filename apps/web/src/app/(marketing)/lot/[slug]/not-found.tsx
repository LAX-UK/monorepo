import { LotPageMessage } from "@/components/lot-page/lot-page-message";
import { ButtonLink, EmptyState } from "@auction/ui/lax";
import { Search } from "lucide-react";
import Link from "next/link";

/** The lot's address doesn't match a lot: say so, and offer search and the current auctions. */
export default function LotNotFound() {
  return (
    <LotPageMessage>
      <EmptyState
        illustration="search"
        title="We can't find that lot"
        description="The link may be mistyped, or the lot may have moved to another sale. Search by artist or title, or browse the current auctions."
        actions={
          <>
            <ButtonLink href="/search" Link={Link} variant="primary" icon={<Search aria-hidden />}>
              Search lots
            </ButtonLink>
            <ButtonLink href="/sales" Link={Link} variant="secondary">
              Current auctions
            </ButtonLink>
          </>
        }
      />
    </LotPageMessage>
  );
}
