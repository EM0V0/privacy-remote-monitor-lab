import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Privacy-aware Remote Monitoring Lab",
    template: "%s · Remote Monitoring Lab",
  },
  description:
    "Scheme A home / remote monitoring and trends — not autonomous diagnosis. Includes EWMA, Page–CUSUM, robust drift probes, differential privacy mean releases with a ε-day ledger, and accountable telemetry ingest.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased bg-slate-50 text-slate-900`}>
        {children}
      </body>
    </html>
  );
}
