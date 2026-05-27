export type ZonedInstant = {
  instant: Date;
  zone: string;
};

/** `yyyy-MM-dd'T'HH:mm` string in the given zone (datetime-local compatible). */
export type DatetimeFormString = string;

/** `HH:mm` string in the given zone. */
export type TimeFormString = string;

/** `yyyy-MM-dd` string in the given zone. */
export type DateFormString = string;
