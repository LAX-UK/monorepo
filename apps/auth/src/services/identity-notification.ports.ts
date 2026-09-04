export interface IIdentityNotifier {
  passwordChanged(input: {
    to: string;
    subjectId: string;
    userName: string;
  }): Promise<void>;
}
