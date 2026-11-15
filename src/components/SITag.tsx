// SI disclosure: written with Claude (Anthropic) under the author's direction; reviewed and tested by the author. See SI_DISCLOSURE.md.
import Link from "next/link";
import s from "./SITag.module.css";

/**
 * Visible watermark for visuals rendered by SI-written code (NASA Space Apps SI rules).
 * Links to the full disclosure.
 */
export default function SITag({ label = "SI-assisted render" }: { label?: string }) {
  return (
    <Link href="/si" className={s.tag} title="Rendered live by code written with Super Intelligence tools. See how SI was used.">
      <span aria-hidden>✦</span> {label}
    </Link>
  );
}
