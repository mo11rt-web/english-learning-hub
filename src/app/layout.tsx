import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-english",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "English Learning Hub | منصة تعليم اللغة الإنجليزية",
  description: "منصة تعليمية متكاملة لتدريس اللغة الإنجليزية",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${inter.variable}`}>
      <body className="font-arabic bg-app-gradient min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
