import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Upsolve",
  description: "Personal competitive-programming tracker",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#eef1f4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} ${bricolage.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
