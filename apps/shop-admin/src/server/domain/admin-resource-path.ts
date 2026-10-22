/**
 * Encodes each segment of an admin resource path, leaving the query string as written.
 * Encoding the whole string would turn `?` and `=` into `%3F` and `%3D`, and the API would
 * answer 404 for a path that ends in `orders%3Flimit%3D50`.
 */
export function encodeAdminResourcePath(path: string): string {
  const queryStart = path.indexOf("?");
  const resource = queryStart === -1 ? path : path.slice(0, queryStart);
  const query = queryStart === -1 ? "" : path.slice(queryStart);
  const encoded = resource
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${encoded}${query}`;
}
