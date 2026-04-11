import { MaterialIcon } from "@/components/ui/material-icon";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="w-full bg-stone-900 text-white">
      <div className="mx-auto grid max-w-[1920px] grid-cols-1 gap-16 px-6 py-24 md:grid-cols-12 md:px-20">
        <div className="md:col-span-5">
          <div className="mb-8 font-headline text-2xl italic text-white">The Digital Curator</div>
          <p className="max-w-md text-xs uppercase leading-relaxed tracking-[0.2em] text-stone-400">
            A global destination for the curation of world-class fine art and timeless digital
            collectibles for the modern connoisseur.
          </p>
          <div className="mt-12 flex gap-6">
            <MaterialIcon
              name="public"
              className="cursor-pointer text-stone-500 hover:text-white"
            />
            <MaterialIcon name="mail" className="cursor-pointer text-stone-500 hover:text-white" />
          </div>
        </div>
        <div className="md:col-span-7 grid grid-cols-2 gap-12 lg:grid-cols-3">
          <div>
            <h5 className="mb-8 font-label text-[10px] font-bold uppercase tracking-[0.3em]">
              Galleries
            </h5>
            <ul className="space-y-4">
              <li>
                <Link
                  href="/"
                  className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-400 transition-colors hover:text-primary"
                >
                  Live Auctions
                </Link>
              </li>
              <li>
                <span className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-400">
                  Past Archives
                </span>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="mb-8 font-label text-[10px] font-bold uppercase tracking-[0.3em]">
              Concierge
            </h5>
            <ul className="space-y-4 font-label text-[10px] uppercase tracking-[0.2em] text-stone-400">
              <li>Bidding Terms</li>
              <li>Global Shipping</li>
              <li>Contact Us</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1920px] flex-col items-center justify-between border-t border-white/5 px-6 py-10 md:flex-row md:px-20">
        <p className="mb-4 font-label text-[9px] uppercase tracking-[0.4em] text-stone-500 md:mb-0">
          © {new Date().getFullYear()} The Digital Curator Gallery. Fine Art Excellence.
        </p>
        <div className="flex gap-8">
          <span className="text-[9px] uppercase tracking-[0.3em] text-stone-600">Privacy</span>
          <span className="text-[9px] uppercase tracking-[0.3em] text-stone-600">Legal</span>
        </div>
      </div>
    </footer>
  );
}
