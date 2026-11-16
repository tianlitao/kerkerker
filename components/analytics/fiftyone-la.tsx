"use client";

import Script from "next/script";

/**
 * 51.LA 统计
 *
 * 站点 ID：3LZNDjo7McO3tnMQ
 * 官方 SDK 会自动接管客户端路由跳转（监听 history 变化），
 * 因此这里只需加载一次，不要在路由变化时重复初始化。
 */
const LA_ID = process.env.NEXT_PUBLIC_51LA_ID || "3LZNDjo7McO3tnMQ";

export function FiftyOneLA() {
  return (
    <Script id="fiftyone-la" strategy="afterInteractive">
      {`
        !function(p){"use strict";!function(t){var s=window,e=document,i=p,c="".concat("https:"===e.location.protocol?"https://":"http://","sdk.51.la/js-sdk-pro.min.js"),n=e.createElement("script"),r=e.getElementsByTagName("script")[0];n.type="text/javascript",n.setAttribute("charset","UTF-8"),n.async=!0,n.src=c,n.id="LA_COLLECT",i.d=n;var o=function(){s.LA.ids.push(i)};s.LA?s.LA.ids&&o():(s.LA=p,s.LA.ids=[],o()),r.parentNode.insertBefore(n,r)}()}({id:"${LA_ID}",ck:"${LA_ID}"});
      `}
    </Script>
  );
}
