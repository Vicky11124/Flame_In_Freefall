// SI disclosure: written with Claude (Anthropic) under the author's direction; reviewed and tested by the author. See SI_DISCLOSURE.md.
import type { Metadata } from "next";
import Explorer from "@/components/explore/Explorer";

export const metadata: Metadata = {
  title: "Dashboard - Ember Atlas",
  description: "Rank, map, compare and question NASA PSI combustion investigations for a crewed habitat atmosphere.",
};

export default function ExplorePage() {
  return <Explorer />;
}
