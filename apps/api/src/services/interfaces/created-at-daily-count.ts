/** Counts rows grouped by UTC calendar day (YYYY-MM-DD) on or after rangeStart. */
export type CreatedAtDailyCountFn = (rangeStart: Date) => Promise<Map<string, number>>;

export interface ICreatedAtDailyCountRepository {
  countCreatedAtByDay(rangeStart: Date): Promise<Map<string, number>>;
}
