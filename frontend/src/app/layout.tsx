import type { Metadata } from "next";
import { IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";

import { CommandHeader } from "@/components/CommandHeader";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "RescueAI · SAR Command",
  description: "Search and Rescue tactical command dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${sourceSans.variable} ${ibmPlexMono.variable} font-sans`}>
        <div className="min-h-screen">
          <CommandHeader />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
