import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/providers/convex-client-provider";
import { Toaster } from "@/components/ui/sonner";
import { ModalProvider } from "@/providers/modal-provider";
import { Suspense } from "react";
import { Loading } from "@/components/auth/loading";
import { Analytics } from "@vercel/analytics/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DrawBetter",
  description:
    "A collaborative drawing app built with Next.js and Liveblocks for real-time creativity.",
  keywords: ["drawing", "collaboration", "real-time", "canvas", "art"],
  authors: [{ name: "Arya Singh" }],
  openGraph: {
    title: "DrawBetter",
    description: "Create and collaborate on drawings in real-time.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DrawBetter",
    description: "A collaborative drawing app for real-time creativity.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Analytics />
        <Suspense
        fallback={<Loading />}
        >
        <ConvexClientProvider>
          <Toaster />
          <ModalProvider />
          {children}
        </ConvexClientProvider>
        </Suspense>
      </body>
    </html>
  );
}
