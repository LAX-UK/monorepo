export type SubjectStatusReader = {
  /** Returns true when the subject is missing, disabled, or merged into another subject. */
  isDisabledOrMerged(subjectId: string): Promise<boolean>;
};
