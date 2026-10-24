/**
 * The visible text of rendered markup, for assertions on copy that is split across elements,
 * such as a sentence whose product names are set in their own colour.
 */
export function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}
