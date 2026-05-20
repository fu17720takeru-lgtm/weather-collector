import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 外部サイトへのHTTPリクエストをサーバーサイド（API Route）から行うための設定
  // weathernews.jp へのフェッチはAPI Route内で行うため、特別な設定は不要
};

export default nextConfig;
