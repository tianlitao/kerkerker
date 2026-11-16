"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Google Analytics 4 (GA4) 统计
 *
 * 数据流：十分阳光 - GA4 (https://www.91aitv.com)
 * 衡量 ID：G-1JW7Y1SC8R
 *
 * 实现要点（反直觉，勿改）：
 * 1. App Router 的客户端路由跳转（<Link>）不会触发浏览器原生导航，
 *    所以 gtag('config') 只在首次进入时上报一次 page_view。
 *    这里额外监听 pathname 变化，手动补发 page_view，否则站内跳转全丢。
 * 2. 首次 page_view 交给 gtag('config') 自动发送，effect 里用 isFirst
 *    跳过首次，避免同一次访问被重复计两次。
 * 3. 用 window.location 而非 useSearchParams 读取 URL，因为
 *    useSearchParams 在 App Router 中会要求 Suspense 边界，
 *    放进 root layout 会强制整站 CSR bailout，得不偿失。
 */

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-1JW7Y1SC8R";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // 首次进入由 gtag('config') 自动上报，这里跳过，防止重复计数
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (typeof window.gtag !== "function") return;

    window.gtag("event", "page_view", {
      page_path: window.location.pathname + window.location.search,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname]);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
