import { PREFERS_DARK_MEDIA_QUERY } from "@/lib/preferences/resolve-theme";
import { THEME_COOKIE_NAME, THEME_STORAGE_KEY } from "@/lib/preferences/theme-cookie";

/** Build the inline bootstrap script so resolution rules stay aligned with {@link resolveIsDarkClass}. */
export function buildThemeInitSnippet(): string {
  const cookieName = JSON.stringify(THEME_COOKIE_NAME);
  const storageKey = JSON.stringify(THEME_STORAGE_KEY);
  const mediaQuery = JSON.stringify(PREFERS_DARK_MEDIA_QUERY);

  return `(function(){try{var d=document.documentElement;function readCookie(n){var a=document.cookie.split(";"),i=0,p,e,q;for(;i<a.length;i++){p=a[i].trim();e=p.indexOf("=");if(e>0&&p.slice(0,e)===n)return decodeURIComponent(p.slice(e+1));}return null;}function validTheme(v){return v==="dark"||v==="light"||v==="system";}function prefersDark(){return window.matchMedia(${mediaQuery}).matches;}function resolveDark(v){if(v==="dark")return true;if(v==="light")return false;return prefersDark();}var ct=readCookie(${cookieName}),ls=window.localStorage.getItem(${storageKey}),pref=validTheme(ct)?ct:(validTheme(ls)?ls:null);d.classList.toggle("dark",resolveDark(pref));var rm=window.localStorage.getItem("lax.reduceMotion");if(rm==="force-reduce"||rm==="force-allow")d.dataset.reduceMotion=rm;}catch(e){}})();`;
}
