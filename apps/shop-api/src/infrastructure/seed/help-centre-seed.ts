import type { Database } from "@auction/db";
import { shopHelpArticle, shopHelpCategory } from "@auction/db/schema";
import {
  type EditorialBlock,
  type EditorialInlineSpan,
  editorialBlocksPlainText,
  parseEditorialBlocks,
} from "@auction/shop-contracts";

const SEED_ACTOR = "seed:help-centre";

/**
 * Policy specifics (returns windows, fees, delivery times) are deliberately left to the Terms,
 * so this content never promises more than the published policies do.
 */
const TERMS: EditorialInlineSpan = { text: "our Terms", marks: ["link"], href: "/legal/terms" };
const CONTACT: EditorialInlineSpan = {
  text: "contact our team",
  marks: ["link"],
  href: "/contact",
};

type SeedQuestion = { slug: string; question: string; answer: EditorialInlineSpan[][] };
type SeedCategory = { slug: string; title: string; questions: SeedQuestion[] };

const text = (value: string): EditorialInlineSpan => ({ text: value });

const CATEGORIES: SeedCategory[] = [
  {
    slug: "buying",
    title: "Buying",
    questions: [
      {
        slug: "how-do-i-buy-an-artwork",
        question: "How do I buy an artwork?",
        answer: [
          [
            text(
              "Browse the collection and open any artwork page. Where a work can be bought online you can add it to your basket. For other works, use the enquiry button and a member of our team will reply with availability and the next steps.",
            ),
          ],
        ],
      },
      {
        slug: "can-i-purchase-as-a-company-or-organisation",
        question: "Can I purchase as a company or organisation?",
        answer: [
          [
            text(
              "Yes. Companies, organisations and institutions are welcome to buy. Send an enquiry from the artwork page and include your organisation’s details.",
            ),
          ],
          [
            text(
              "Our team will confirm what information is needed, such as the organisation’s legal name and billing details, so that the invoice and ownership records are issued correctly.",
            ),
          ],
        ],
      },
      {
        slug: "what-payment-options-are-available",
        question: "What payment options are available?",
        answer: [
          [
            text(
              "The payment methods you can use are shown at checkout. For works bought by enquiry, our team will confirm the options with you before the purchase is completed. See ",
            ),
            TERMS,
            text(" for the full payment conditions."),
          ],
        ],
      },
    ],
  },
  {
    slug: "shipping-and-delivery",
    title: "Shipping and delivery",
    questions: [
      {
        slug: "how-is-my-artwork-packed-and-delivered",
        question: "How is my artwork packed and delivered?",
        answer: [
          [
            text(
              "Each work is packed to protect it in transit. Delivery arrangements depend on the size and nature of the work, and our team will talk you through the options before you buy.",
            ),
          ],
        ],
      },
      {
        slug: "do-you-deliver-internationally",
        question: "Do you deliver internationally?",
        answer: [
          [
            text(
              "Delivery destinations vary from one artwork to another. If you are outside the UK, send an enquiry about the work you are interested in and we will confirm what is possible.",
            ),
          ],
        ],
      },
      {
        slug: "can-i-track-my-delivery",
        question: "Can I track my delivery?",
        answer: [
          [
            text(
              "Where tracking is available, the details are shared once your artwork has been dispatched. If you would like an update on your order, ",
            ),
            CONTACT,
            text(" and quote your order number."),
          ],
        ],
      },
    ],
  },
  {
    slug: "returns",
    title: "Returns",
    questions: [
      {
        slug: "can-i-return-an-artwork",
        question: "Can I return an artwork?",
        answer: [
          [
            text("When an artwork can be returned, and how, is set out in "),
            TERMS,
            text(
              ". Please read them before you buy, and get in touch if you have a question about a particular work.",
            ),
          ],
        ],
      },
      {
        slug: "what-if-my-artwork-arrives-damaged",
        question: "What if my artwork arrives damaged?",
        answer: [
          [
            text(
              "Please contact us as soon as you can. Keep all of the packaging and send photographs of the artwork and the packaging along with your order details, and we will explain the next steps.",
            ),
          ],
        ],
      },
      {
        slug: "how-do-i-start-a-return",
        question: "How do I start a return?",
        answer: [
          [
            CONTACT,
            text(
              " with your order details and we will guide you through the process described in our Terms.",
            ),
          ],
        ],
      },
    ],
  },
  {
    slug: "private-viewings",
    title: "Private viewings",
    questions: [
      {
        slug: "can-i-see-an-artwork-in-person",
        question: "Can I see an artwork in person?",
        answer: [
          [
            text(
              "In many cases, yes. Use the enquiry button on the artwork page, or contact us, and a member of our team will let you know whether a private viewing can be arranged for that work.",
            ),
          ],
        ],
      },
      {
        slug: "where-do-private-viewings-take-place",
        question: "Where do private viewings take place?",
        answer: [
          [
            text("Viewings are held at our gallery. Our "),
            { text: "visit page", marks: ["link"], href: "/visit" },
            text(" has the address and details of how to find us."),
          ],
        ],
      },
      {
        slug: "can-i-bring-someone-to-a-private-viewing",
        question: "Can I bring someone to a private viewing?",
        answer: [
          [
            text(
              "Let us know who will be attending when you arrange the viewing, so that we can prepare for your visit.",
            ),
          ],
        ],
      },
    ],
  },
  {
    slug: "your-account",
    title: "Your account",
    questions: [
      {
        slug: "how-do-i-create-an-account",
        question: "How do I create an account?",
        answer: [
          [
            text(
              "Choose Register from the menu and follow the steps. An account lets you save artworks, follow artists and keep track of your enquiries.",
            ),
          ],
        ],
      },
      {
        slug: "how-do-i-reset-my-password",
        question: "How do I reset my password?",
        answer: [
          [
            text(
              "Choose the forgotten password option on the sign-in page and follow the instructions we email to you.",
            ),
          ],
        ],
      },
      {
        slug: "how-do-i-save-artworks-and-follow-artists",
        question: "How do I save artworks and follow artists?",
        answer: [
          [
            text(
              "While you are signed in, select the heart on an artwork or the Follow button on an artist’s page. Everything you save appears in your account.",
            ),
          ],
        ],
      },
    ],
  },
];

function answerBlocks(paragraphs: readonly EditorialInlineSpan[][]): EditorialBlock[] {
  return parseEditorialBlocks(paragraphs.map((spans) => ({ type: "richText", spans })));
}

/**
 * Idempotent: rows are matched by slug and rewritten, so editing this file and reseeding updates
 * a local environment. Everything is published so lax.art has content to show straight away.
 */
export async function seedHelpCentre(db: Database): Promise<void> {
  const now = new Date();
  for (const [categoryPosition, category] of CATEGORIES.entries()) {
    const categoryValues = {
      title: category.title,
      position: categoryPosition,
      status: "published" as const,
      updatedBy: SEED_ACTOR,
    };
    const [saved] = await db
      .insert(shopHelpCategory)
      .values({ slug: category.slug, ...categoryValues })
      .onConflictDoUpdate({
        target: shopHelpCategory.slug,
        set: { ...categoryValues, updatedAt: now },
      })
      .returning({ id: shopHelpCategory.id });
    if (!saved) throw new Error(`help_category_seed_failed:${category.slug}`);

    for (const [position, question] of category.questions.entries()) {
      const answer = answerBlocks(question.answer);
      const values = {
        categoryId: saved.id,
        question: question.question,
        answerBlocks: answer,
        answerText: editorialBlocksPlainText(answer),
        position,
        status: "published" as const,
        publishedAt: now,
        updatedBy: SEED_ACTOR,
      };
      await db
        .insert(shopHelpArticle)
        .values({ slug: question.slug, ...values })
        .onConflictDoUpdate({
          target: shopHelpArticle.slug,
          set: { ...values, updatedAt: now },
        });
    }
  }
}
