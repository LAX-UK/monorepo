import { MarketingImageIcon } from "@auction/marketing-ui";
import Image from "next/image";

/** Square artwork thumbnail for order rows and lines; decorative, the title carries the name. */
export function ShopOrderThumbnail({ src, size }: { src: string | null; size: 48 | 64 }) {
  return (
    <span className={`shop-order-thumb shop-order-thumb--${size}`} aria-hidden>
      {src ? (
        <Image src={src} alt="" width={size} height={size} sizes={`${size}px`} />
      ) : (
        <MarketingImageIcon className="shop-order-thumb__placeholder" />
      )}
    </span>
  );
}
