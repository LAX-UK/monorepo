import type { ShopOrderInvoiceCardVm } from "@/lib/account/shop-order-invoice-card.vm";

function FileIcon({ crossed = false }: { crossed?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="shop-invoice-card__glyph" fill="none">
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {crossed ? (
        <path d="M9.5 12.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.6" />
      ) : (
        <path d="M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * The invoice on a paid Shop order, once Books issues it: being prepared (and late), issued under
 * its number with LAX's stored PDF, or cancelled. Nothing is drawn while it is LAX's own invoice:
 * the page keeps its "Download invoice (PDF)" under "Help with this order", as before.
 */
export function ShopOrderInvoiceCard({ card }: { card: ShopOrderInvoiceCardVm }) {
  if (card.kind === "lax") return null;
  return (
    <section
      className="shop-order-panel"
      aria-labelledby="order-invoice-heading"
      data-invoice-state={card.kind}
    >
      <h2 id="order-invoice-heading" className="shop-order-panel__title">
        Invoice
      </h2>
      {card.kind === "preparing" || card.kind === "delayed" ? (
        <div className="shop-invoice-card">
          <div className="shop-invoice-card__row">
            <span className="shop-invoice-card__icon">
              <FileIcon />
            </span>
            <div className="shop-invoice-card__body">
              <p className="shop-invoice-card__title">{card.title}</p>
              {card.kind === "preparing" ? (
                <p className="shop-invoice-card__text">{card.detail}</p>
              ) : null}
            </div>
          </div>
          {card.kind === "delayed" ? (
            <output className="shop-invoice-card__warning">{card.detail}</output>
          ) : null}
          <p className="shop-invoice-card__text">{card.note}</p>
        </div>
      ) : null}
      {card.kind === "issued" ? (
        <div className="shop-invoice-card">
          <div className="shop-invoice-card__body">
            <p className="shop-invoice-card__title">{card.title}</p>
            <p className="shop-invoice-card__text">{card.meta}</p>
          </div>
          <a
            href={card.download.href}
            className="shop-invoice-card__download shop-focus-ring"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="shop-invoice-card__icon">
              <FileIcon />
            </span>
            <span className="shop-invoice-card__download-label">{card.download.label}</span>
          </a>
        </div>
      ) : null}
      {card.kind === "cancelled" ? (
        <div className="shop-invoice-card__row">
          <span className="shop-invoice-card__icon">
            <FileIcon crossed />
          </span>
          <div className="shop-invoice-card__body">
            <p className="shop-invoice-card__title">{card.title}</p>
            <p className="shop-invoice-card__text">{card.detail}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
