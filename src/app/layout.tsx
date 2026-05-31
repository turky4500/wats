import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";

export const metadata: Metadata = {
  title: "MultiWA عربي - منصة واتساب للأعمال",
  description: "منصة متكاملة لإدارة واتساب للأعمال مع نظام اشتراكات ولوحة إدارة متقدمة",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="font-tajawal bg-gray-50 min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
