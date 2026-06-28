/** X/Twitter intent URL for sharing an article. */
export function buildTwitterShareUrl(url: string, title: string): string {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
}

/** LinkedIn off-site share URL for an article. */
export function buildLinkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}
