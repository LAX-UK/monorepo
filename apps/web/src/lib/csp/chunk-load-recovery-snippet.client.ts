import {
  STALE_CHUNK_LEGACY_RELOAD_KEY,
  STALE_CHUNK_RELOAD_GUARD_MS,
  STALE_CHUNK_RELOAD_KEY,
} from "@/lib/socket-chunk-recovery.client";

/**
 * Inline, site-wide recovery for a page left open across a deploy: its route code asks for
 * content-hashed files the new build no longer serves, so lazy components on the current page
 * fail with 404s. (Next itself already recovers client navigations by build id, and the live
 * socket has its own recovery in `socket-chunk-recovery.client`; this covers the other lazy
 * chunks on the page being viewed.)
 *
 * When a `/_next/static/` script or stylesheet fails to load, or a lazy import rejects with a
 * chunk-load error, the file is checked once with an uncached `HEAD` (only while online). If the
 * server says it is gone (404 or 410) the page is marked stale. Nothing reloads at that moment,
 * because the failure may come from a background load and the person may be mid-task. The page
 * moves onto the current build only:
 *  - when the tab becomes hidden, provided no dialog is open, nothing is marked busy, no
 *    form was just submitted, and no field has focus or has been edited; or
 *  - on the next same-origin link click, which is turned into a full navigation.
 * A reload is never started while the browser is already leaving the page.
 *
 * Edits are recorded from `input`/`change` events (capture phase) rather than by comparing a
 * field's `value` with its `defaultValue`: React keeps the two equal for controlled inputs, so a
 * comparison cannot see what was typed into them. The mark is cleared when a form is submitted or
 * reset, and is ignored once the path differs from the one the edit was made on. The
 * checked/selected comparison is kept for uncontrolled fields. "Leaving" is cleared a second
 * after a `beforeunload` (the person may have cancelled it) and on `pageshow`.
 *
 * The link handler runs in the capture phase ahead of React, so on a stale page an anchor whose
 * own `onClick` prevents the default (e.g. an account switch link) gets a plain navigation to its
 * `href` instead; such anchors keep a working `href` for that reason.
 *
 * The reload is claimed in `sessionStorage` under the key the socket recovery uses, at most once
 * per tab every ten minutes, so an unhealthy deploy cannot cause a reload loop and the two paths
 * never both reload. If a second deploy lands inside that window the page is not reloaded again;
 * the surfaces' own notices (bid boundary "Reload", the socket's paused notice) remain the way
 * out. If storage cannot be read, nothing reloads. It is plain inline script, allowed by its
 * static hash like the theme script, so it adds no route JavaScript. Bytes here must match the
 * CSP hash in middleware.
 */
export function buildChunkLoadRecoverySnippet(): string {
  const key = JSON.stringify(STALE_CHUNK_RELOAD_KEY);
  const legacy = JSON.stringify(STALE_CHUNK_LEGACY_RELOAD_KEY);
  return `(function(){var K=${key},L=${legacy},G=${STALE_CHUNK_RELOAD_GUARD_MS},busy=false,stale=false,leaving=false,sub=0,ed="";function path(){return window.location.pathname}function field(t){return!!t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))&&!/^(hidden|submit|button|reset|image)$/.test(t.type||"")}function ok(u){return typeof u==="string"&&u.indexOf("/_next/static/")>-1}function claim(){try{var s=window.sessionStorage,l=Math.max(Number(s.getItem(K))||0,Number(s.getItem(L))||0);if(l>0&&Date.now()-l<G)return false;s.setItem(K,String(Date.now()));return true}catch(e){return false}}function dirty(){var d=document,a=d.activeElement;if(a&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)))return true;if(d.querySelector('[role="dialog"][data-state="open"],[aria-modal="true"],[aria-busy="true"]'))return true;if(Date.now()-sub<15000)return true;if(ed){if(ed===path())return true;ed=""}var f=d.querySelectorAll("input,textarea,select"),i,e,o,j;for(i=0;i<f.length;i++){e=f[i];if(e.tagName==="SELECT"){for(j=0;j<e.options.length;j++){o=e.options[j];if(o.selected!==o.defaultSelected)return true}}else if(e.type==="checkbox"||e.type==="radio"){if(e.checked!==e.defaultChecked)return true}else if(!/^(hidden|submit|button|reset|image|file)$/.test(e.type)&&e.value!==e.defaultValue)return true}return false}function reloadIfSafe(){if(!stale||leaving||dirty()||!claim())return;leaving=true;window.location.reload()}function recover(u){if(stale||busy||!ok(u)||navigator.onLine===false)return;busy=true;fetch(u,{method:"HEAD",cache:"no-store"}).then(function(r){busy=false;if(r.status===404||r.status===410){stale=true;if(document.visibilityState==="hidden")reloadIfSafe()}},function(){busy=false})}window.addEventListener("error",function(e){var t=e.target;if(!t||!t.tagName)return;if(t.tagName==="SCRIPT")recover(t.src);else if(t.tagName==="LINK")recover(t.href)},true);window.addEventListener("unhandledrejection",function(e){var r=e.reason,m=r&&r.message?String(r.message):"";if(!r||!(r.name==="ChunkLoadError"||/Loading (CSS )?chunk \\S+ failed|dynamically imported module/.test(m)))return;var x=/\\/_next\\/static\\/[^\\s"')]+/.exec(m);recover(r.request||(x?x[0]:null))});window.addEventListener("beforeunload",function(){leaving=true;setTimeout(function(){leaving=false},1000)});window.addEventListener("pagehide",function(){leaving=true});window.addEventListener("pageshow",function(){leaving=false});function edit(e){if(field(e.target))ed=path()}window.addEventListener("input",edit,true);window.addEventListener("change",edit,true);window.addEventListener("reset",function(){ed=""},true);window.addEventListener("submit",function(){sub=Date.now();ed=""},true);document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")reloadIfSafe()});window.addEventListener("click",function(e){if(!stale||leaving||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a||(a.target&&a.target!=="_self")||a.hasAttribute("download"))return;var u;try{u=new URL(a.href,window.location.href)}catch(x){return}if(u.origin!==window.location.origin||(u.pathname===window.location.pathname&&u.search===window.location.search))return;e.preventDefault();e.stopImmediatePropagation();leaving=true;window.location.assign(u.href)},true)})()`;
}

export const CHUNK_LOAD_RECOVERY_SNIPPET = buildChunkLoadRecoverySnippet();
