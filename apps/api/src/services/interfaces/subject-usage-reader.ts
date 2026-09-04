export type SubjectUsage = {
  hasProductProfile: boolean;
  hasExternalLink: boolean;
};

export interface ISubjectUsageReader {
  getSubjectUsage(subjectId: string): Promise<SubjectUsage>;
}
