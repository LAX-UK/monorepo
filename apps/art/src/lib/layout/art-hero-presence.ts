import { createHeroPresence } from "@auction/marketing-ui";

/*
 * Whether the page currently rendered has a hero under the header. Heroes register on mount, so a
 * page without an image (or a slower streamed one) is reflected without the layout knowing the data.
 * The server cannot see mounted heroes; it renders assuming one, matching `artRouteMayHaveHero`.
 */
const artHeroPresence = createHeroPresence({ assumedOnServer: true });

export const registerArtHero = artHeroPresence.register;
export const useArtHeroPresent = artHeroPresence.useHeroPresent;
