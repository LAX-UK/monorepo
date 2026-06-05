export type OnsiteEventClientRow = {
  id: string;
  email: string;
  name: string;
  suspended: boolean;
};

export interface IOnsiteEventClientReader {
  findByEmail(email: string): Promise<OnsiteEventClientRow | null>;
}
