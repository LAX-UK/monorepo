export type SectionPosition = {
  id: string;
  /** Top of the section relative to the viewport, in px. */
  top: number;
};

/**
 * The section a reader is in: the last one whose top has passed the reading line, in page
 * order. Before any section reaches the line, the first one is current. Unlike reacting to
 * whichever section last crossed a thin band, this always names the section on screen, so a
 * short section further down (Overview) is never marked while the catalogue fills the view.
 */
export function activeSectionId(positions: readonly SectionPosition[], line: number): string {
  const ordered = [...positions].sort((a, b) => a.top - b.top);
  let active = ordered[0]?.id ?? "";
  for (const section of ordered) {
    if (section.top <= line) active = section.id;
  }
  return active;
}
