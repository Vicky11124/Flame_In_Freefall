import type { Metadata } from "next";
import FlameLabApp from "@/components/lab/FlameLabApp";

export const metadata: Metadata = {
  title: "Flame Lab - Flame in Freefall",
  description: "Burn cotton, Nomex, PMMA and more in a virtual microgravity wind tunnel. Change oxygen, pressure, airflow and gravity.",
};

export default function LabPage() {
  return <FlameLabApp />;
}
