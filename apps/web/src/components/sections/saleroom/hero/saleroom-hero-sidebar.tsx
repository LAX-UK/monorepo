import type { ReactNode } from "react";

type Props = {
  timing: ReactNode;
  stats: ReactNode;
  toolbar: ReactNode;
  actions: ReactNode;
};

export function SaleroomHeroSidebar({ timing, stats, toolbar, actions }: Props) {
  return (
    <div className="fade-up-d3 flex min-w-0 flex-col gap-6 lg:min-h-full lg:gap-8">
      {timing}
      {stats}
      {toolbar ? <div className="flex flex-col gap-4">{toolbar}</div> : null}
      {actions ? <div className="flex flex-col gap-4 lg:mt-auto">{actions}</div> : null}
    </div>
  );
}
