import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SWRProvider } from "@/components/providers/swr-provider";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "十分阳光 - 免费影视在线观看",
  description:
    "十分阳光 - 免费观看最新热门影视剧集，海量高清资源在线播放，支持多集连播",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* 移动端视频播放优化 - 防止浏览器接管视频 */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="x5-fullscreen" content="true" />
        <meta name="x5-page-mode" content="app" />
        <meta name="browsermode" content="application" />

        {/* Google Analytics 4 — 十分阳光 (G-1JW7Y1SC8R) */}
        <GoogleAnalytics />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} >
        <SWRProvider>{children}</SWRProvider>
      </body>
    </html>
  );
}
