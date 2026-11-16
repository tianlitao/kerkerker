import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "页面不存在 - 十分阳光",
  description: "你访问的页面不存在或已被移除。",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full bg-black flex items-center justify-center">
      <div className="text-center px-6">
        <p className="text-red-600 text-6xl font-bold tracking-tight mb-3">
          404
        </p>
        <h1 className="text-white text-xl mb-2">页面不存在</h1>
        <p className="text-white/50 text-sm mb-8">
          该页面可能已被移除，或者链接地址有误。
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            返回首页
          </Link>
          <Link
            href="/browse/movies"
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            浏览影视
          </Link>
        </div>
      </div>
    </div>
  );
}
