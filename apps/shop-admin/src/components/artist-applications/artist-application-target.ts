/** What an action needs to know about an application, from a list row or the record page. */
export type ArtistApplicationTarget = {
  id: string;
  version: number;
  title: string;
  workCount: number;
  artistName: string | null;
};
