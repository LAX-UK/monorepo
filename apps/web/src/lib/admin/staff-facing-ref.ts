/** Staff-facing label for a technical value — primary copy only; raw id lives in disclosure. */
export type StaffFacingRef = {
  primary: string;
  secondary?: string;
  technicalValue?: string;
  copyLabel?: string;
};
