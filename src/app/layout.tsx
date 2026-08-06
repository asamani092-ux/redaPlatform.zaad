import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "منصة رداء",
  description: "منصة إدارة معارض رداء للمستفيدين والحضور والصرف والمخزون",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" data-theme="light">
      <body className="zad-root antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
