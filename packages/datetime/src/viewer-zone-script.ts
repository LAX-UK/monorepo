import { LONDON_TIME_ZONE } from "./constants.js";
import { VIEWER_ZONE_COOKIE, VIEWER_ZONE_COOKIE_MAX_AGE_SEC } from "./viewer-zone.js";

/** The class the head script puts on `<html>` when the visitor's clock differs from the sale's. */
export const TZ_AWAY_CLASS = "tz-away";

/**
 * The inline head script, as a string, so a page can hash it for its CSP and a test can run it.
 *
 * It reads the device zone, stores it in `lax_tz` when it changed (never over a zone the visitor
 * chose), and adds `tz-away` to `<html>` when the visitor's clock differs from London's right now,
 * which holds the time chip's row before the page paints. Everything is wrapped so that an
 * exception, a blocked cookie or an old browser never stops the page.
 */
export function buildViewerZoneScript(officialZone: string = LONDON_TIME_ZONE): string {
  const name = JSON.stringify(VIEWER_ZONE_COOKIE);
  const official = JSON.stringify(officialZone);
  const awayClass = JSON.stringify(TZ_AWAY_CLASS);
  return `(function(){try{var d=document.documentElement,N=${name};function rc(){var a=document.cookie.split(";"),i=0,p,e;for(;i<a.length;i++){p=a[i].trim();e=p.indexOf("=");if(e>0&&p.slice(0,e)===N){try{return decodeURIComponent(p.slice(e+1));}catch(x){return p.slice(e+1);}}}return null;}function ok(z){return typeof z==="string"&&z.indexOf("/")>0&&z.indexOf("Etc/")!==0;}function off(z,t){var p=new Intl.DateTimeFormat("en-US",{timeZone:z,hourCycle:"h23",year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric"}).formatToParts(new Date(t)),v={},i;for(i=0;i<p.length;i++)v[p[i].type]=+p[i].value;return Date.UTC(v.year,v.month-1,v.day,v.hour,v.minute,v.second)-Math.floor(t/1000)*1000;}var dev=Intl.DateTimeFormat().resolvedOptions().timeZone,raw=rc(),fixed=raw!==null&&raw.indexOf("fixed:")===0,saved=fixed?raw.slice(6):raw;if(!fixed&&ok(dev)&&dev!==saved){document.cookie=N+"="+encodeURIComponent(dev)+"; path=/; max-age=${VIEWER_ZONE_COOKIE_MAX_AGE_SEC}; samesite=lax"+(location.protocol==="https:"?"; secure":"");}var eff=fixed?saved:dev;if(ok(eff)){var t=Date.now();if(off(eff,t)!==off(${official},t))d.classList.add(${awayClass});}}catch(e){}})();`;
}
