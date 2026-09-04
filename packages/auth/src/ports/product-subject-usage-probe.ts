export type ProductSubjectUsageProbe = {
  getSubjectUsage(subjectId: string): Promise<{
    hasProductProfile: boolean;
    hasExternalLink: boolean;
  }>;
};
