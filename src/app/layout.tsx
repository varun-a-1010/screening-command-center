import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Screening Command Center",
  description: "Live audience-impact investigation with Gemini and Grafana MCP",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

