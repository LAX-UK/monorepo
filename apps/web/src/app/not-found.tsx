import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-[70vh] flex-col items-center justify-center bg-surface px-6 py-24 text-center"
    >
      <p className="mb-4 font-label text-xs font-bold uppercase tracking-[0.4em] text-primary">
        404
      </p>
      <h1 className="mb-6 font-headline text-4xl tracking-tight text-on-surface md:text-5xl">
        This lot has left the saleroom
      </h1>
      <p className="mb-10 max-w-md font-body text-sm text-on-surface-variant">
        The page you requested is not in the current catalogue. Return to the gallery to continue
        browsing.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center bg-gradient-to-br from-primary to-primary-container px-10 py-4 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary shadow-md transition-opacity hover:opacity-95"
      >
        Back to gallery
      </Link>
    </main>
  );
}
