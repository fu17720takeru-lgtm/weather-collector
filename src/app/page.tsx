"use client";
/**
 * page.tsx - メインページ（天気データ一覧画面）
 *
 * "use client" とは？
 * - Next.js App Router では、デフォルトでコンポーネントはサーバーサイドで実行される
 * - useState や useEffect などの React フックを使う場合は "use client" が必要
 * - クライアント（ブラウザ）で実行されるコンポーネントであることを宣言する
 *
 * このページの役割：
 * - /api/weather を呼び出して保存済みの天気データを取得・表示する
 * - 「手動取得」ボタンで /api/collect を呼び出してデータを収集・保存する
 * - ローディング・エラー・データなし の各状態を適切に表示する
 */

import { useState, useEffect, useCallback } from "react";
import { WeatherRecord, WeatherApiResponse, CollectApiResponse } from "@/types/weather";

// ==============================
// 型定義（このファイル内で使う）
// ==============================

type Status = "idle" | "loading" | "success" | "error";

// ==============================
// ユーティリティ関数
// ==============================

/**
 * ISO 8601 の日時文字列を日本語の読みやすい形式に変換する
 * 例: "2025-05-20T14:00:00.000Z" → "2025/05/20 23:00"
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 数値を小数点1桁でフォーマットする
 * null の場合は "---" を返す
 */
function formatNumber(value: number | null, unit: string): string {
  if (value === null) return "---";
  return `${value.toFixed(1)} ${unit}`;
}

// ==============================
// サブコンポーネント
// ==============================

/** ローディングスピナー */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
      <span className="ml-3 text-gray-600">データを読み込み中...</span>
    </div>
  );
}

/** エラー表示 */
function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none mt-0.5">⚠️</span>
        <div>
          <p className="font-semibold">エラーが発生しました</p>
          <p className="text-sm mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}

/** データなし表示 */
function EmptyState() {
  return (
    <div className="text-center py-16 text-gray-500">
      <div className="text-5xl mb-4">🌤️</div>
      <p className="text-lg font-medium">データがありません</p>
      <p className="text-sm mt-2">
        「手動でデータ取得」ボタンを押してデータを収集してください
      </p>
    </div>
  );
}

/** 成功メッセージ（トースト風） */
function SuccessMessage({ message }: { message: string }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
      <div className="flex items-center gap-2">
        <span>✅</span>
        <p>{message}</p>
      </div>
    </div>
  );
}

// ==============================
// メインコンポーネント
// ==============================

export default function HomePage() {
  // ---- State 定義 ----
  /** 表示する天気レコードの一覧 */
  const [records, setRecords] = useState<WeatherRecord[]>([]);
  /** データ取得中の状態管理 */
  const [fetchStatus, setFetchStatus] = useState<Status>("idle");
  /** データ収集中の状態管理 */
  const [collectStatus, setCollectStatus] = useState<Status>("idle");
  /** エラーメッセージ */
  const [errorMessage, setErrorMessage] = useState<string>("");
  /** 成功メッセージ（収集完了後に表示） */
  const [successMessage, setSuccessMessage] = useState<string>("");
  /** 最終更新日時 */
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ---- データ取得関数 ----

  /**
   * /api/weather を呼び出して保存済みデータを取得する
   * useCallback でメモ化することで、不要な再生成を防ぐ
   */
  const fetchRecords = useCallback(async () => {
    setFetchStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/weather?limit=200");
      const json: WeatherApiResponse = await response.json();

      if (!json.success || !json.data) {
        throw new Error(json.error || "データの取得に失敗しました");
      }

      setRecords(json.data);
      setFetchStatus("success");
      setLastUpdated(new Date());
    } catch (err) {
      setFetchStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  /**
   * /api/collect を呼び出して天気データを収集・保存する
   * 完了後に fetchRecords() を呼んでテーブルを更新する
   */
  const handleCollect = async () => {
    setCollectStatus("loading");
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/collect", { method: "POST" });
      const json: CollectApiResponse = await response.json();

      if (!json.success) {
        throw new Error(json.error || "データ収集に失敗しました");
      }

      setCollectStatus("success");
      setSuccessMessage(json.message || "データを取得・保存しました");

      // 収集完了後、テーブルを最新状態に更新
      await fetchRecords();

      // 5秒後に成功メッセージを消す
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setCollectStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setCollectStatus("idle");
    }
  };

  // ---- 初回ロード時にデータを取得 ----
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ---- ボタンの無効化判定 ----
  const isCollecting = collectStatus === "loading";
  const isFetching = fetchStatus === "loading";

  // ==============================
  // JSX（画面レイアウト）
  // ==============================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⛅</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Weather Data Collector
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                指定地域の1時間ごとの気温・風速・降水量を保存・閲覧できます
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* コントロールパネル */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* 最終更新情報 */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                データ管理
              </h2>
              {lastUpdated && (
                <p className="text-xs text-gray-400 mt-1">
                  最終更新: {lastUpdated.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </p>
              )}
              <p className="text-xs text-gray-400">
                現在のレコード数: {records.length} 件
              </p>
            </div>

            {/* ボタン群 */}
            <div className="flex gap-3 flex-wrap">
              {/* 手動取得ボタン */}
              <button
                onClick={handleCollect}
                disabled={isCollecting || isFetching}
                className="
                  inline-flex items-center gap-2 px-5 py-2.5
                  bg-blue-600 text-white font-medium rounded-lg
                  hover:bg-blue-700 active:bg-blue-800
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-150
                  text-sm
                "
              >
                {isCollecting ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    取得中...
                  </>
                ) : (
                  <>
                    <span>☁️</span>
                    手動でデータ取得
                  </>
                )}
              </button>

              {/* データ更新ボタン */}
              <button
                onClick={fetchRecords}
                disabled={isFetching || isCollecting}
                className="
                  inline-flex items-center gap-2 px-5 py-2.5
                  bg-gray-100 text-gray-700 font-medium rounded-lg
                  hover:bg-gray-200 active:bg-gray-300
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-150
                  text-sm
                "
              >
                {isFetching ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full" />
                    更新中...
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    テーブル更新
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 成功メッセージ */}
        {successMessage && <SuccessMessage message={successMessage} />}

        {/* エラーメッセージ */}
        {errorMessage && <ErrorMessage message={errorMessage} />}

        {/* 天気データテーブル */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              天気データ一覧
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              観測日時の新しい順で表示（最大200件）
            </p>
          </div>

          {/* ローディング中 */}
          {isFetching && records.length === 0 && <LoadingSpinner />}

          {/* データなし */}
          {!isFetching && records.length === 0 && fetchStatus !== "error" && (
            <EmptyState />
          )}

          {/* データあり: テーブル表示 */}
          {records.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                      観測日時
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                      地域
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 whitespace-nowrap">
                      気温 (℃)
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 whitespace-nowrap">
                      風速 (m/s)
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 whitespace-nowrap">
                      降水量 (mm)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((record, index) => (
                    <tr
                      key={record.id}
                      className={`
                        hover:bg-blue-50 transition-colors duration-100
                        ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                      `}
                    >
                      {/* 観測日時 */}
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-mono text-xs">
                        {formatDateTime(record.observed_at)}
                      </td>

                      {/* 地域 */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {record.area}
                        </span>
                      </td>

                      {/* 気温 */}
                      <td className="px-4 py-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            record.temperature !== null && record.temperature >= 30
                              ? "text-red-600"
                              : record.temperature !== null && record.temperature <= 10
                              ? "text-blue-600"
                              : "text-gray-800"
                          }`}
                        >
                          {formatNumber(record.temperature, "℃")}
                        </span>
                      </td>

                      {/* 風速 */}
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        {formatNumber(record.wind_speed, "m/s")}
                      </td>

                      {/* 降水量（雨の場合は青色表示） */}
                      <td className="px-4 py-3 text-right font-mono">
                        <span
                          className={
                            record.precipitation !== null && record.precipitation > 0
                              ? "text-blue-600 font-semibold"
                              : "text-gray-700"
                          }
                        >
                          {formatNumber(record.precipitation, "mm")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* フッター */}
        <footer className="text-center text-xs text-gray-400 py-4">
          <p>
            天気データは{" "}
            <a
              href="https://weathernews.jp"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              weathernews.jp
            </a>{" "}
            から取得しています（選考課題・技術検証目的）
          </p>
          <p className="mt-1">
            定期実行: Vercel Cron（1時間ごと）| DB: Supabase PostgreSQL
          </p>
        </footer>
      </main>
    </div>
  );
}
