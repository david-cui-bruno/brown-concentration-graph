import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brown Concentration Graph",
  description:
    "Explore how Brown University courses and official prerequisites connect to undergraduate concentrations. Unofficial student project.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
