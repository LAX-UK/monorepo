import { cn } from "../lib/cn.js";

/**
 * A record's main picture in a panel or on a record page: the whole image, letterboxed in a 4:3
 * frame on the sunken fill, radius md with a hairline, so portrait and landscape works sit the
 * same way. The alt text names the record.
 */
export function RecordImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn(
        "aspect-[4/3] w-full rounded-staff-md border border-staff-line bg-staff-sunken object-contain",
        className,
      )}
    />
  );
}
