import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "@/globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Yuksi Bayi",
  description: "Yuksi Bayi Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${nunito.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
