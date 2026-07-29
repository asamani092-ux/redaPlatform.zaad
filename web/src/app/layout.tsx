import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "منصة رداء",
  description: "منصة إدارة معارض رداء للمستفيدين والحضور والصرف والمخزون",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased" style={{ fontFamily: "Tajawal, Tahoma, Arial, sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
