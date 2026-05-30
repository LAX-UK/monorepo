import { DASHBOARD_LIST_THUMBNAIL_CLASS } from "@/components/dashboard/list/dashboard-list-thumbnail-class";
import { MediaImage } from "@/components/ui/media-image";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  src: string | null | undefined;
  alt?: string;
  label?: string;
  sizes?: string;
  imgClassName?: string;
  children?: ReactNode;
};

/** Linked lot thumbnail for dashboard mobile list rows. */
export function DashboardMobileLotThumbnail({
  href,
  src,
  alt = "",
  label = "Lot artwork",
  sizes = "56px",
  imgClassName,
  children,
}: Props) {
  return (
    <Link href={href} className={DASHBOARD_LIST_THUMBNAIL_CLASS}>
      {children ?? (
        <MediaImage
          src={src ?? null}
          alt={alt}
          label={label}
          sizes={sizes}
          {...(imgClassName ? { imgClassName } : {})}
        />
      )}
    </Link>
  );
}
