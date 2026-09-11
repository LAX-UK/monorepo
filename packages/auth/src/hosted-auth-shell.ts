export function escapeHostedHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Shared LAX task-page styling for issuer-hosted credential flows. */
export const HOSTED_AUTH_STYLES = `:root {
  color-scheme: light dark;
  --page-bg: #0b0b0c;
  --surface: #141416;
  --on-surface: #f5f5f4;
  --on-surface-variant: #a8a29e;
  --border: rgba(255, 255, 255, 0.12);
  --accent: #c9a962;
  --accent-hover: #ddc27a;
  --danger: #f87171;
  --focus: #93c5fd;
  --column: min(100%, 528px);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  font-family: "Helvetica Neue", Arial, sans-serif;
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(201, 169, 98, 0.18), transparent),
    var(--page-bg);
  color: var(--on-surface);
}
main {
  margin: 0 auto;
  max-width: var(--column);
  padding: 3rem 1.5rem 5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: center;
}
.brand {
  letter-spacing: 0.35em;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--accent);
}
.panel {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  padding: 1.5rem;
}
h1 {
  margin: 0;
  font-size: clamp(1.5rem, 4vw, 2rem);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
}
.lead {
  margin: 0;
  text-align: center;
  color: var(--on-surface-variant);
  line-height: 1.6;
  font-size: 0.95rem;
}
form {
  display: grid;
  gap: 1rem;
}
label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--on-surface-variant);
}
input, button, a.button {
  font: inherit;
}
input {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.25);
  color: var(--on-surface);
  padding: 0.85rem 1rem;
}
input:focus-visible, button:focus-visible, a.button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
button, a.button {
  border: 0;
  border-radius: 999px;
  padding: 0.85rem 1.25rem;
  background: var(--accent);
  color: #111;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
}
button:hover, a.button:hover { background: var(--accent-hover); }
button.secondary {
  background: transparent;
  color: var(--on-surface);
  border: 1px solid var(--border);
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  justify-content: center;
  font-size: 0.9rem;
}
.links a { color: var(--accent); }
#error {
  margin: 0;
  color: var(--danger);
  font-size: 0.9rem;
}
#success {
  margin: 0;
  color: #86efac;
  font-size: 0.9rem;
}
hr {
  width: 100%;
  border: 0;
  border-top: 1px solid var(--border);
}`;

export type HostedAuthPage = {
  title: string;
  description?: string;
  body: string;
  scriptSrc?: string;
};

export function buildHostedAuthHtml(page: HostedAuthPage): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHostedHtml(page.title)}</title>
  <style>${HOSTED_AUTH_STYLES}</style>
</head>
<body>
  <main>
    <div class="brand" aria-hidden="true">LAX</div>
    <div>
      <h1>${escapeHostedHtml(page.title)}</h1>
      ${page.description ? `<p class="lead">${escapeHostedHtml(page.description)}</p>` : ""}
    </div>
    <div class="panel">${page.body}</div>
  </main>
  ${page.scriptSrc ? `<script src="${escapeHostedHtml(page.scriptSrc)}" defer></script>` : ""}
</body>
</html>`;
}
