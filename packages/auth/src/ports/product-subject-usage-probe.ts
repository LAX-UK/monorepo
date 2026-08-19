export type ProductSubjectUsageProbe = {
  hasProductProfile(subjectId: string): Promise<boolean>;
  hasExternalLink(subjectId: string): Promise<boolean>;
};
