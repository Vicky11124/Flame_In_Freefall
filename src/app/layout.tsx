import type { Metadata, Viewport } from "next";
import { Instrument_Serif, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import PageTransition from "@/components/PageTransition";

const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const sans = IBM_Plex_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Flame in Freefall - Fire safety intelligence from NASA microgravity combustion data",
  description:
    "An AI-assisted dashboard that ranks, compares and explains NASA PSI combustion investigations for spacecraft, lunar and Mars fire safety.",
};

export const viewport: Viewport = { themeColor: "#0b0a09" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
        {children}
        <PageTransition />
      </body>
    </html>
  );
}
