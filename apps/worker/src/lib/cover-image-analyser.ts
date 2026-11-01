import type { CoverImageMeasurements } from "@auction/domain";
import type { CoverBreakpointName, CoverTextSide, UnitPoint, UnitRect } from "@auction/types";

/** What to measure on a cover picture: the crop the hero will show and where the text sits. */
export type CoverMeasureRequest = {
  /** The stored picture. */
  bytes: Buffer;
  /** A pre-crop of the picture (a detail of a lot photograph), before the hero crop. */
  preCrop?: UnitRect | undefined;
  focal: UnitPoint;
  zoom: number;
  textSide: CoverTextSide;
  breakpoints: readonly CoverBreakpointName[];
};

/** Port for reading a cover picture's pixels (DIP: the job decides, the adapter decodes). */
export type CoverImageAnalyser = {
  measure(request: CoverMeasureRequest): Promise<CoverImageMeasurements>;
};
