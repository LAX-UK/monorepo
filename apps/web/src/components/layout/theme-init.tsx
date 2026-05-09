import Script from "next/script";

const SNIPPET = `(function(){try{var d=document.documentElement;var s=localStorage.getItem("theme");if(s==="dark"){d.classList.add("dark")}else if(s==="light"){d.classList.remove("dark")}else if(window.matchMedia("(prefers-color-scheme:dark)").matches){d.classList.add("dark")}else{d.classList.remove("dark")}var rm=localStorage.getItem("lax.reduceMotion");if(rm==="force-reduce"||rm==="force-allow"){d.dataset.reduceMotion=rm}}catch(e){}})();`;

export function ThemeInit() {
  return (
    <Script id="theme-init" strategy="beforeInteractive">
      {SNIPPET}
    </Script>
  );
}
