export type SubjectStatusReader = {
  isDisabledOrMerged(subjectId: string): Promise<boolean>;
};
