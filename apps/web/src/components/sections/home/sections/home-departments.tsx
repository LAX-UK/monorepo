import { MarketingSection } from "@/components/marketing/marketing-section";
import { MediaImage } from "@/components/ui/media-image";
import type { HomeDepartment } from "@/lib/home-sections/types";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { MarketingCardMedia } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

/** What the house sells, one square mat per department with a work from it. */
export function HomeDepartmentsSection({
  departments,
}: { departments: readonly HomeDepartment[] }) {
  return (
    <MarketingSection id="home-departments" heading="Departments" subtitle="What we sell">
      <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-5 p-0 md:grid-cols-3 md:gap-6 lg:grid-cols-6">
        {departments.map((department) => (
          <li key={department.id} className="min-w-0">
            <article className="group relative flex min-w-0 flex-col">
              <MarketingCardMedia className="marketing-work-mat aspect-square">
                <Link
                  href={department.href}
                  tabIndex={-1}
                  aria-hidden
                  className="absolute inset-0 block p-[18%]"
                >
                  <span className="relative block size-full [&_img]:!object-contain">
                    <MediaImage
                      src={department.imageUrl}
                      alt=""
                      label={department.name}
                      sizes="(max-width: 768px) 50vw, 16vw"
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
    </MarketingSection>
  );
}
