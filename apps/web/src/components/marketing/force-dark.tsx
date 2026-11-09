"use client";
import * as React from "react";

/**
 * Marketing and auth always render in the dark "Instrument" theme. The wrapper element carries
 * `className="dark"`, but Radix portals (menus, selects, tooltips, toasts) mount on <body>, so we
 * also hold the `dark` class on <html> while these routes are mounted, then restore the visitor's
 * own preference on the way out.
 */
export function ForceDark() {
  React.useLayoutEffect(() => {
    const el = document.documentElement;
    const ensure = () => {
      if (!el.classList.contains("dark")) el.classList.add("dark");
    };
    ensure();
    const obs = new MutationObserver(ensure);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => {
      obs.disconnect();
      try {
        const t = localStorage.getItem("rp_theme") || "dark";
        const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        el.classList.toggle("dark", dark);
      } catch {
        /* keep dark */
      }
    };
  }, []);
  return null;
}
