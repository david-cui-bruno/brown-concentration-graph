import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://brown-concentration-graph.vercel.app"),
  title: "Brown Course Constellations",
  description:
    "A 3D galaxy of Brown's curriculum: every course is a star, prerequisites form constellations. Track your concentration progress. Unofficial student project.",
  openGraph: {
    title: "Brown Course Constellations",
    description:
      "Every Brown course as a star. Explore prerequisites, concentrations, and your own star chart in 3D.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Brown Course Constellations",
    description: "Every Brown course as a star. Explore prerequisites and concentrations in 3D.",
    images: ["/og.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
