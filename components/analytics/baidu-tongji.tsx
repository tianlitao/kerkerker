"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * 百度统计
 *
 * 站点 ID：3de919cf21f9a4551914213af2ceebc9
 *
 * 实现要点（反直觉，勿改）：
 * 1. hm.js 的配置里 spa:0，默认不加载 UrlChangeTracker，
 *    只上报首屏；Next.js App Router 的站内跳转走 pushState，
 *    不触发浏览器导航，不手动补 _trackPageview 的话站内 PV 全丢。
 * 2. 首次 PV 由 hm.js 自动上报（autoPageview 默认开启），
 *    effect 里用 lastPath 记录已上报路径，首次不 push，避免同一次访问计两次。
 *    用路径而不是布尔值，因为 StrictMode 下 effect 会执行两次，
 *    布尔标记会被第二次执行绕过去，产生重复 PV。
 * 3. 只在 push 前保证 _hmt 存在即可：hm.js 尚未加载完时 push 会进队列，
 *    等 hm.js 初始化后自动回放，不会丢。
 * 4. 若以后在百度统计后台开启了"单页应用"开关（spa:1），
 *    UrlChangeTracker 会自己上报，这里的手动 push 必须同时删掉，否则双计。
 */
const HM_ID =
  process.env.NEXT_PUBLIC_BAIDU_TONGJI_ID || "3de919cf21f9a4551914213af2ceebc9";

declare global {
  interface Window {
    _hmt?: unknown[][];
  }
}

export function BaiduTongji() {
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  useEffect(() => {
    // 首次进入由 hm.js 自动上报；路径没变时也不重复上报
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    window._hmt = window._hmt || [];
    window._hmt.push([
      "_trackPageview",
      window.location.pathname + window.location.search,
    ]);
  }, [pathname]);

  return (
    <Script id="baidu-tongji" strategy="afterInteractive">
      {`
        var _hmt = _hmt || [];
        (function() {
          var hm = document.createElement("script");
          hm.src = "https://hm.baidu.com/hm.js?${HM_ID}";
          var s = document.getElementsByTagName("script")[0];
          s.parentNode.insertBefore(hm, s);
        })();
      `}
    </Script>
  );
}
