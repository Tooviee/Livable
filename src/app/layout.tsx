import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Livable — Help for foreigners in Korea",
  description:
    "Submit your request. We help foreigners living in Korea with bureaucracy, housing, visas, and daily life.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="font-sans antialiased min-h-screen bg-stone-950 text-stone-100">
        {children}
      </body>
    </html>
  );
}
