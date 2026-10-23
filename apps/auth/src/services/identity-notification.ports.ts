export interface IIdentityNotifier {
  passwordChanged(input: { subjectId: string }): Promise<void>;
}
