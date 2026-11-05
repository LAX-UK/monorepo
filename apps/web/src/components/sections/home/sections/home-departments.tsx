import { MarketingSection } from "@/components/marketing/marketing-section";
import { ScrollRegion } from "@/components/marketing/rail/scroll-region";
import { MediaImage } from "@/components/ui/media-image";
import type { HomeDepartment } from "@/lib/home-sections/types";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { MarketingCardMedia } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

/**
 * What the house sells: one square tile per department with a picture, from the one list of
 * departments. A rail you swipe on a phone, a grid from tablet width.
 */
export function HomeDepartmentsSection({
  departments,
}: { departments: readonly HomeDepartment[] }) {
  return (
    <MarketingSection id="home-departments" heading="Departments" subtitle="What we sell">
      <ScrollRegion
        id="home-departments-rail"
        label="Department tiles"
        className="-mx-4 px-4 md:mx-0 md:overflow-visible md:px-0"
      >
        <ul className="m-0 flex list-none snap-x snap-proximity gap-3 p-0 md:grid md:grid-cols-3 md:gap-6 lg:grid-cols-6">
          {departments.map((department) => (
            <li
              key={department.id}
              className="w-[38vw] max-w-44 shrink-0 snap-start md:w-auto md:max-w-none md:min-w-0"
            >
              <article className="group relative flex min-w-0 flex-col">
                <MarketingCardMedia className="marketing-work-mat aspect-square">
                  <Link
                    href={department.href}
                    tabIndex={-1}
                    aria-hidden
                    className={cn(
                      "absolute inset-0 block",
                      department.imageSource === "lot" && "p-[18%]",
                    )}
                  >
                    <span
                      className={cn(
                        "relative block size-full",
                        department.imageSource === "lot"
                          ? "[&_img]:!object-contain"
                          : "[&_img]:!object-cover",
                      )}
                    >
                      <MediaImage
                        src={department.imageUrl}
                        alt=""
                        label={department.name}
                        sizes="(max-width: 768px) 38vw, 16vw"
                      />
                    </span>
                  </Link>
                </MarketingCardMedia>
                <h3 className="m-0 mt-3 font-headline text-[15px] font-medium leading-[22px] text-on-surface md:text-base md:leading-6">
                  <Link
                    href={department.href}
                    className={cn("rounded-sm underline-offset-4 hover:underline", FOCUS_RING)}
                  >
                    {department.name}
                  </Link>
                </h3>
              </article>
            </li>
          ))}
        </ul>
      </ScrollRegion>
    </MarketingSection>
  );
}
