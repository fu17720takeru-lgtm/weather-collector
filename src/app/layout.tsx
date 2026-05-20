/**
 * layout.tsx - アプリ全体の共通レイアウト
 *
 * なぜNext.jsを使うのか？
 * - React だけでは「ページルーティング」「サーバーサイド処理（API Route）」が付属しない
 * - Next.js を使うことで、以下を1つのプロジェクトにまとめられる：
 *   1. フロントエンド（React コンポーネント）
 *   2. バックエンド API（API Route: /api/collect, /api/weather）
 *   3. サーバーサイドレンダリング
 * - Vercel との親和性が高く、デプロイが非常に簡単
 * - App Router（Next.js 13+）によりファイルベースのルーティングが直感的
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Google Fonts の Inter フォントを読み込む
// Next.js が最適化してくれるため、パフォーマンスへの影響が少ない
const inter = Inter({ subsets: ["latin"] });

/**
 * メタデータ設定
 * <head> タグ内の <title> や <meta> を Next.js が自動で生成してくれる
 */
export const metadata: Metadata = {
  title: "Weather Data Collector",
  description: "指定地域の1時間ごとの気温・風速・降水量を保存・閲覧できます",
};

/**
 * RootLayout - すべてのページを囲む共通レイアウト
 * children にはページのコンポーネントが入る
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-gray-50 text-gray-900 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
