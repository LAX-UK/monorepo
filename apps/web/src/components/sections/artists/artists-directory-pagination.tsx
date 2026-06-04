import { MarketingPaginationControls } from "@/components/marketing/marketing-pagination-controls";
import { MARKETING_PAGE_INNER } from "@/lib/marketing/chrome";

type Props = {
  currentPage: number;
  totalPages: number;
  getPageHref: (page: number) => string;
};

export function ArtistsDirectoryPagination({ currentPage, totalPages, getPageHref }: Props) {
  return (
    <MarketingPaginationControls
      ariaLabel="Artist directory pages"
      currentPage={currentPage}
      totalPages={totalPages}
      getPageHref={getPageHref}
      className={`${MARKETING_PAGE_INNER} mt-12 flex justify-center border-t border-border-hairline pt-10`}
    />
  );
}
