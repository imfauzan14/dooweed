import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dooweed - Expense Tracker",
  description: "Personal expense and income tracker with OCR receipt scanning",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        <div className="flex min-h-screen">
          <Navigation />
          <main className="flex-1 lg:ml-0 overflow-auto pb-20 lg:pb-0">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
