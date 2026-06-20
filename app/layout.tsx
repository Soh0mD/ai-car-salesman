import type { Metadata } from "next";
import { Montserrat, Quicksand, Geist_Mono } from "next/font/google";
import "./globals.css";

// "Joyride" type pairing: Montserrat for confident headlines, Quicksand for friendly body/UI.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "dascar — find your next car without the tab chaos",
  description:
    "Answer a few quick questions and dascar searches real listings across dealers and private sellers, ranks them by value, and flags the lemons.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${quicksand.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
