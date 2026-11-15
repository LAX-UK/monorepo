import {
  STALE_CHUNK_RELOAD_GUARD_MS,
  STALE_CHUNK_RELOAD_KEY,
} from "@/lib/socket-chunk-recovery.client";

/**
 * Inline, site-wide recovery for a page left open across a deploy: its route code asks for
 * content-hashed files the new build no longer serves, so navigation and lazy components fail
 * with 404s. Next's own recovery covers only the live socket surface.
 *
 * When a `/_next/static/` script or stylesheet fails to load, or a lazy import rejects with a
 * chunk-load error, the file is checked once with an uncached `HEAD` (only while online). If the
 * server says it is gone (404 or 410) the page reloads onto the current build. The reload is
 * claimed in `sessionStorage` under the key the socket recovery uses, at most once per tab every
 * ten minutes, so an unhealthy deploy cannot cause a reload loop and the two paths never both
 * reload. It is plain inline script, allowed by its static hash like the theme script, so it adds
 * no route JavaScript. Bytes here must match the CSP hash in middleware.
 */
export function buildChunkLoadRecoverySnippet(): string {
  const key = JSON.stringify(STALE_CHUNK_RELOAD_KEY);
  return `(function(){var K=${key},G=${STALE_CHUNK_RELOAD_GUARD_MS},busy=false;function ok(u){return typeof u==="string"&&u.indexOf("/_next/static/")>-1}function claim(){try{var s=window.sessionStorage,l=Number(s.getItem(K));if(l>0&&Date.now()-l<G)return false;s.setItem(K,String(Date.now()));return true}catch(e){return false}}function recover(u){if(busy||!ok(u)||navigator.onLine===false)return;busy=true;fetch(u,{method:"HEAD",cache:"no-store"}).then(function(r){busy=false;if((r.status===404||r.status===410)&&claim())window.location.reload()},function(){busy=false})}window.addEventListener("error",function(e){var t=e.target;if(!t||!t.tagName)return;if(t.tagName==="SCRIPT")recover(t.src);else if(t.tagName==="LINK")recover(t.href)},true);window.addEventListener("unhandledrejection",function(e){var r=e.reason,m=r&&r.message?String(r.message):"";if(!r||!(r.name==="ChunkLoadError"||/Loading (CSS )?chunk \\S+ failed|dynamically imported module/.test(m)))return;var x=/\\/_next\\/static\\/[^\\s"')]+/.exec(m);recover(r.request||(x?x[0]:null))})})()`;
}

export const CHUNK_LOAD_RECOVERY_SNIPPET = buildChunkLoadRecoverySnippet();
