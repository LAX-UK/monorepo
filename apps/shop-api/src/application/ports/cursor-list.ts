export type CursorListInput = {
  cursor?: string | undefined;
  limit?: number | undefined;
};

export type CursorListResult<T> = {
  items: T[];
  nextCursor: string | null;
};
