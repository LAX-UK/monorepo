export interface IIdentityNotifier {
  passwordChanged(input: { subjectId: string }): Promise<void>;
  /** LAX support removed the person's two-step verification; they must hear about it. */
  twoFactorResetBySupport(input: { subjectId: string }): Promise<void>;
}
