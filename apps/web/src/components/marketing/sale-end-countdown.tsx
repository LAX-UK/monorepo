"use client";

import { Countdown } from "@auction/ui";

type Props = {
  end: Date;
  className?: string;
};

export function SaleEndCountdown({ end, className }: Props) {
  return (
    <Countdown
      end={end}
      announce
      {...(className !== undefined && className !== "" ? { className } : {})}
    />
  );
}
