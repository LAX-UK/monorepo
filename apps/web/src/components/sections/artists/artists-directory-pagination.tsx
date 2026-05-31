import { MarketingPaginationControls } from "@/components/marketing/marketing-pagination-controls";

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
      className="mt-10"
      paginationClassName="justify-start"
    />
  );
}
