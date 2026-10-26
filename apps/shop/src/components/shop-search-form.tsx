import { shopButtonClassName } from "@/components/shop-commerce-button";
import { cn } from "@auction/ui";

type ShopSearchFormProps = {
  /** Id prefix, so two forms on one page keep unique field ids. */
  id: string;
  className?: string;
};

/**
 * A plain search form for editions and artists. It submits to the catalogue (`/artworks?q=`) and
 * works without JavaScript, so it suits pages such as 404 that must help on their own.
 */
export function ShopSearchForm({ id, className }: ShopSearchFormProps) {
  const fieldId = `${id}-q`;
  return (
    <form action="/artworks" method="get" className={cn("shop-search-form", className)}>
      <label htmlFor={fieldId} className="shop-search-form__label">
        Search editions and artists
      </label>
      <div className="shop-search-form__row">
        <input
          id={fieldId}
          name="q"
          type="search"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Artist or title"
          className="shop-field shop-search-form__input"
        />
        <button
          type="submit"
          className={shopButtonClassName("outline", "standard", "shop-search-form__submit")}
        >
          Search
        </button>
      </div>
    </form>
  );
}
