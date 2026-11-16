"use client";

import Script from "next/script";

/**
 * 51.LA 统计
 *
 * 站点 ID：3LZNDjo7McO3tnMQ
 *
 * 实现要点（反直觉，勿改）：
 * 1. SDK 默认 hashMode:false，只上报首屏，不监听 history.pushState。
 *    而 Next.js App Router 的站内跳转全部走 pushState，不触发浏览器导航，
 *    不开 hashMode 的话所有站内跳转在 51.LA 里都会丢失。
 * 2. 必须显式传 hashMode:true。该选项只是打开 pushState/replaceState 监听，
 *    行为等价于 PV 统计，不是"只统计 hash 路由"。
 * 3. 脚本只加载一次，交给 SDK 自己处理路由变化，不要按 pathname 重复 init。
 */
const LA_ID = process.env.NEXT_PUBLIC_51LA_ID || "3LZNDjo7McO3tnMQ";

export function FiftyOneLA() {
  return (
    <Script id="fiftyone-la" strategy="afterInteractive">
      {`
        !function(p){"use strict";!function(t){var s=window,e=document,i=p,c="".concat("https:"===e.location.protocol?"https://":"http://","sdk.51.la/js-sdk-pro.min.js"),n=e.createElement("script"),r=e.getElementsByTagName("script")[0];n.type="text/javascript",n.setAttribute("charset","UTF-8"),n.async=!0,n.src=c,n.id="LA_COLLECT",i.d=n;var o=function(){s.LA.ids.push(i)};s.LA?s.LA.ids&&o():(s.LA=p,s.LA.ids=[],o()),r.parentNode.insertBefore(n,r)}()}({id:"${LA_ID}",ck:"${LA_ID}",hashMode:!0});
      `}
    </Script>
  );
}
