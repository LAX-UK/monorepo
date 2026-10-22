import type { EditorialEntityKind } from "./editorial-entity-forms";

export type EditorialEntityCopy = {
  kind: EditorialEntityKind;
  /** Lower case, for sentences such as "Someone else saved this exhibition". */
  singular: string;
  title: string;
  description: string;
  newLabel: string;
  empty: { title: string; description: string };
};

export const EDITORIAL_ENTITIES: Record<EditorialEntityKind, EditorialEntityCopy> = {
  exhibitions: {
    kind: "exhibitions",
    singular: "exhibition",
    title: "Exhibitions",
    description: "Exhibitions, films and events shown on lax.art.",
    newLabel: "New exhibition",
    empty: {
      title: "No exhibitions yet",
      description: "Create the first exhibition as a draft, then publish it when it is ready.",
    },
  },
  stories: {
    kind: "stories",
    singular: "story",
    title: "Stories",
    description: "Articles, films, podcast episodes, press and guides for lax.art.",
    newLabel: "New story",
    empty: {
      title: "No stories yet",
      description: "Create the first story as a draft, then publish it when it is ready.",
    },
  },
  venues: {
    kind: "venues",
    singular: "venue",
    title: "Venues",
    description: "Galleries and locations that exhibitions take place at.",
    newLabel: "New venue",
    empty: {
      title: "No venues yet",
      description: "Add a venue so exhibitions can say where they are shown.",
    },
  },
  pages: {
    kind: "pages",
    singular: "page",
    title: "Pages",
    description: "Fixed pages such as how to buy, each with its own address on lax.art.",
    newLabel: "New page",
    empty: {
      title: "No pages yet",
      description: "Create the first page as a draft, then publish it when it is ready.",
    },
  },
};

export const EDITORIAL_ENTITY_KINDS = Object.keys(EDITORIAL_ENTITIES) as EditorialEntityKind[];

export function parseEditorialEntityKind(value: string): EditorialEntityKind | null {
  return (EDITORIAL_ENTITY_KINDS as string[]).includes(value)
    ? (value as EditorialEntityKind)
    : null;
}

export function editorialListHref(kind: EditorialEntityKind): string {
  return `/editorial/${kind}`;
}
