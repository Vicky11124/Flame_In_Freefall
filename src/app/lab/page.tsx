// SI disclosure: written with Claude (Anthropic) under the author's direction; reviewed and tested by the author. See SI_DISCLOSURE.md.
import type { Metadata } from "next";
import FlameLabApp from "@/components/lab/FlameLabApp";

export const metadata: Metadata = {
  title: "Flame Lab - Ember Atlas",
  description: "Burn cotton, Nomex, PMMA and more in a virtual microgravity wind tunnel. Change oxygen, pressure, airflow and gravity.",
};

export default function LabPage() {
  return <FlameLabApp />;
}
