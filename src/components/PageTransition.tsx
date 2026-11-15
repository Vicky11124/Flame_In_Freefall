// SI disclosure: written with Claude (Anthropic) under the author's direction; reviewed and tested by the author. See SI_DISCLOSURE.md.
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import s from "./PageTransition.module.css";

type Stage = "idle" | "closing" | "closed" | "opening";

const CLOSE_MS = 520; // doors sliding shut
const HOLD_MS = 240; // minimum time the seam burns before the doors part
const OPEN_MS = 700;

/**
 * Blast-door page transition: two panels close from the sides, meet on a flame seam,
 * the route changes behind them, then they part again.
 * Intercepts same-origin <a> clicks (Next <Link> renders <a>), so pages need no changes.
 */
export default function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const [stage, setStage] = useState<Stage>("idle");
  const pending = useRef<{ path: string; at: number } | null>(null);

  const open = () => {
    setStage("opening");
    window.setTimeout(() => {
      setStage("idle");
      pending.current = null;
    }, OPEN_MS);
  };

  // 1) intercept internal navigations
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // same page: anchors, query tweaks
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      e.preventDefault();
      e.stopPropagation();
      if (pending.current) return;
      pending.current = { path: url.pathname, at: performance.now() };
      router.prefetch(url.pathname + url.search);
      setStage("closing");
      window.setTimeout(() => {
        setStage("closed");
        router.push(url.pathname + url.search + url.hash);
      }, CLOSE_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  // 2) once the new route has rendered, open the doors
  useEffect(() => {
    const p = pending.current;
    if (!p || pathname !== p.path) return;
    const wait = Math.max(0, CLOSE_MS + HOLD_MS - (performance.now() - p.at));
    const t = window.setTimeout(() => {
      window.scrollTo(0, 0);
      open();
    }, wait);
    return () => window.clearTimeout(t);
  }, [pathname]);

  // safety net: never leave the doors shut if a navigation fails
  useEffect(() => {
    if (stage !== "closed") return;
    const t = window.setTimeout(open, 8000);
    return () => window.clearTimeout(t);
  }, [stage]);

  if (stage === "idle") return null;
  return (
    <div className={`${s.root} ${s[stage]}`} aria-hidden>
      <div className={`${s.door} ${s.left}`}>
        <span className={s.edge} />
      </div>
      <div className={`${s.door} ${s.right}`}>
        <span className={s.edge} />
      </div>
      <div className={s.seam} />
      <div className={s.emblem}>
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="21" r="15" className={s.ring} />
          <path className={s.outer} d="M20 5c4.5 5.8 7.3 10.2 7.3 14.6 0 4.4-3.3 7.6-7.3 7.6s-7.3-3.2-7.3-7.6C12.7 15.2 15.5 10.8 20 5z" />
          <path className={s.inner} d="M20 15.5c1.8 2.4 2.8 4.2 2.8 5.8 0 1.6-1.3 2.9-2.8 2.9s-2.8-1.3-2.8-2.9c0-1.6 1-3.4 2.8-5.8z" />
        </svg>
      </div>
    </div>
  );
}
