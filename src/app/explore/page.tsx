import type { Metadata } from "next";
import Explorer from "@/components/explore/Explorer";

export const metadata: Metadata = {
  title: "Dashboard - Flame in Freefall",
  description: "Rank, map, compare and question NASA PSI combustion investigations for a crewed habitat atmosphere.",
};

export default function ExplorePage() {
  return <Explorer />;
}
