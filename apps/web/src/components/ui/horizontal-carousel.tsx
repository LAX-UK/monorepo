"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  cn,
} from "@auction/ui";
import { Children, type ReactNode, isValidElement } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  ariaLabel?: string;
};

/** Horizontal Embla carousel — pass slide nodes as children (no render props across RSC boundary). */
export function HorizontalCarousel({
  children,
  className,
  itemClassName,
  ariaLabel = "Carousel",
}: Props) {
  const slides = Children.toArray(children);
  if (slides.length === 0) return null;

  return (
    <Carousel className={cn("w-full", className)} aria-label={ariaLabel}>
      <CarouselContent className="-ml-4">
        {slides.map((slide, index) => {
          const slideKey =
            isValidElement(slide) && slide.key != null ? String(slide.key) : `slide-${index}`;
          return (
            <CarouselItem
              key={slideKey}
              className={cn("basis-full sm:basis-1/2 lg:basis-1/3", itemClassName)}
            >
              {slide}
            </CarouselItem>
          );
        })}
      </CarouselContent>
      {slides.length > 1 ? (
        <>
          <CarouselPrevious className="-left-3 top-[calc(50%-1rem)] hidden md:inline-flex" />
          <CarouselNext className="-right-3 top-[calc(50%-1rem)] hidden md:inline-flex" />
        </>
      ) : null}
    </Carousel>
  );
}
