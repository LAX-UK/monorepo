/** Display names for LAX Admin staff, by identity subject. People without a name are left out. */
export interface StaffNameReader {
  namesFor(subjects: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
