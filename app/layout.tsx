import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "OSKA DUE | Your payments, in perspective",
  description: "Your Payments. Your People. One Dashboard.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  themeColor: "#10151d",
  width: "device-width",
  initialScale: 1,
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
