import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AuthLayout } from '@/components/AuthLayout';
import { CategoriesProvider } from '@/contexts/CategoriesContext';

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
        <AuthProvider>
          <CategoriesProvider>
            <AuthLayout>
              <ProtectedRoute>
                {children}
              </ProtectedRoute>
            </AuthLayout>
          </CategoriesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
