/**
 * weather.ts - 天気データ取得ロジック
 *
 * なぜ天気取得処理を別ファイルに分けるのか？
 * - 「データ取得」と「APIの処理」という異なる責務を分離するため（関心の分離）
 * - weathernews.jp のHTML構造が変わったとき、このファイルだけ修正すれば良い
 * - モックデータへの切り替えが1か所でできるため、テストが容易になる
 * - 将来的に別の天気サービスに移行する場合も、このファイルを差し替えるだけで済む
 *
 * 2段階構成：
 * 1. fetchWeatherFromWeatherNews() - weathernews.jp から実際にHTMLを取得して解析
 * 2. fetchMockWeatherData()         - 動作確認・テスト用のサンプルデータを返す
 *
 * 環境変数 USE_MOCK_DATA=true のときはモックデータを使う
 */

import * as cheerio from "cheerio";
import { WeatherData } from "@/types/weather";

// ==============================
// 設定値（環境変数で上書き可能）
// ==============================

/**
 * 取得対象の地域名
 * 環境変数 TARGET_AREA で変更可能（デフォルト: 千葉）
 */
const TARGET_AREA = process.env.TARGET_AREA || "千葉";

/**
 * weathernews.jp の千葉地点ページURL
 * 千葉市の緯度経度: 35.6054°N, 140.1233°E
 * 環境変数 WEATHERNEWS_URL で別の地点に変更可能
 *
 * ※ 利用規約について：
 * このスクレイピングは選考課題としての技術検証目的です。
 * 実運用時は公式APIまたは許可された取得方法に置き換えてください。
 */
const WEATHERNEWS_URL =
  process.env.WEATHERNEWS_URL ||
  "https://weathernews.jp/onebox/35.6054/140.1233/";

// ==============================
// ユーティリティ関数
// ==============================

/**
 * 文字列から数値を安全にパースする
 * 取得できなかった場合は null を返す（エラーにしない）
 */
function parseNumber(str: string | undefined | null): number | null {
  if (!str) return null;
  // 全角数字→半角に変換、不要な文字（℃, m/s, mm, 空白）を除去
  const cleaned = str
    .replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .replace(/[℃°Cm\/s㎜mm\s　]/g, "")
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * 現在時刻を「時間」単位で切り捨てたDateオブジェクトを返す
 * 例: 14:37:22 → 14:00:00
 */
function truncateToHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

// ==============================
// モックデータ（動作確認用）
// ==============================

/**
 * fetchMockWeatherData - テスト・動作確認用のサンプルデータを返す
 *
 * USE_MOCK_DATA=true のときに使用する。
 * 過去24時間分のデータをランダム生成して返す。
 * weathernews.jp が取得できない環境でもアプリの動作確認ができる。
 */
export async function fetchMockWeatherData(): Promise<WeatherData[]> {
  const now = new Date();
  const results: WeatherData[] = [];

  // 過去24時間分のデータを生成（直近から順に）
  for (let hoursAgo = 0; hoursAgo < 24; hoursAgo++) {
    const observedAt = truncateToHour(
      new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)
    );

    // 千葉の5月の気温帯（15〜25℃程度）をランダムに生成
    const temperature = Math.round((15 + Math.random() * 10) * 10) / 10;
    // 風速（0〜8 m/s）
    const windSpeed = Math.round(Math.random() * 8 * 10) / 10;
    // 降水量（多くの時間は0mm、たまに雨）
    const precipitation =
      Math.random() < 0.8 ? 0 : Math.round(Math.random() * 5 * 10) / 10;

    results.push({
      observed_at: observedAt.toISOString(),
      area: TARGET_AREA,
      temperature,
      wind_speed: windSpeed,
      precipitation,
    });
  }

  return results;
}

// ==============================
// 実データ取得（weathernews.jp スクレイピング）
// ==============================

/**
 * fetchWeatherFromWeatherNews - weathernews.jp からHTMLを取得して解析する
 *
 * weathernews.jp の /onebox/{lat}/{lon}/ ページには
 * 1時間ごとの予報データ（気温・風速・降水量）が含まれている。
 *
 * ⚠️ 注意：
 * - weathernews.jp のHTML構造は予告なく変わる可能性がある
 * - 取得に失敗した場合はエラーをスローする（呼び出し側でハンドリングすること）
 * - 実運用時は公式APIへの移行を検討すること
 */
export async function fetchWeatherFromWeatherNews(): Promise<WeatherData[]> {
  // Step 1: weathernews.jp からHTMLを取得
  let html: string;
  try {
    const response = await fetch(WEATHERNEWS_URL, {
      headers: {
        // ブラウザのUser-Agentを指定することで一部のサイトでブロックを回避
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      // Next.js のキャッシュを無効化（毎回最新データを取得する）
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `weathernews.jp へのリクエストが失敗しました: HTTP ${response.status}`
      );
    }
    html = await response.text();
  } catch (err) {
    throw new Error(
      `weathernews.jp の取得中にエラーが発生しました: ${String(err)}`
    );
  }

  // Step 2: cheerio でHTMLをパース（jQueryライクなAPIで要素を操作できる）
  const $ = cheerio.load(html);
  const results: WeatherData[] = [];

  /**
   * weathernews.jp /onebox/ の HTML 構造（2024年時点）
   *
   * ページには JavaScript で動的にレンダリングされる部分もあるが、
   * 基本的な予報テーブルは静的HTMLとして含まれている。
   *
   * 以下の複数のセレクタを試して、マッチするものを使う戦略を取る。
   * HTML構造が変わった場合はこの部分を修正してください。
   */

  // --- アプローチ A: テーブル形式の場合 ---
  // 1時間ごとのデータが <tr> で並んでいるケース
  const tableRows = $("table tr, .forecast-table tr, .hourly tr");

  if (tableRows.length > 0) {
    const now = new Date();

    tableRows.each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length < 3) return; // データが足りない行はスキップ

      // セルの並びは「時刻 | 気温 | 風速 | 降水量」と仮定
      // 実際の構造に合わせて index を調整してください
      const timeText = $(cells[0]).text().trim();
      const tempText = $(cells[1]).text().trim();
      const windText = $(cells[2]).text().trim();
      const precipText = cells.length > 3 ? $(cells[3]).text().trim() : null;

      // 時刻文字列から観測日時を生成
      // 例: "14時" や "14:00" → その日の14:00:00 JST
      const hourMatch = timeText.match(/(\d{1,2})(?:時|:)/);
      if (!hourMatch) return;

      const hour = parseInt(hourMatch[1], 10);
      const observedAt = new Date(now);
      observedAt.setHours(hour, 0, 0, 0);
      // 現在時刻より未来の場合は前日とみなす（翌日0時〜のデータを正しく扱う）
      if (observedAt.getTime() > now.getTime() + 60 * 60 * 1000) {
        observedAt.setDate(observedAt.getDate() - 1);
      }

      results.push({
        observed_at: observedAt.toISOString(),
        area: TARGET_AREA,
        temperature: parseNumber(tempText),
        wind_speed: parseNumber(windText),
        precipitation: precipText ? parseNumber(precipText) : null,
      });
    });
  }

  // --- アプローチ B: JSON-LD / script タグに埋め込みデータがある場合 ---
  // 一部のサイトは構造化データをJSONで埋め込んでいる
  if (results.length === 0) {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).text());
        // 構造化データの形式に応じてパース（サイト固有の実装が必要）
        if (json && json["@type"] === "WeatherForecast") {
          // TODO: 実際のJSONスキーマに合わせて実装
          console.log("JSON-LD形式の天気データを検出しました:", json["@type"]);
        }
      } catch {
        // パース失敗は無視
      }
    });
  }

  // --- アプローチ C: data属性で時刻・気温が埋め込まれている場合 ---
  if (results.length === 0) {
    $("[data-hour]").each((_, el) => {
      const hour = parseInt($(el).attr("data-hour") || "0", 10);
      const temp = parseNumber($(el).attr("data-temp") || $(el).find(".temp").text());
      const wind = parseNumber($(el).attr("data-wind") || $(el).find(".wind").text());
      const prec = parseNumber($(el).attr("data-prec") || $(el).find(".prec").text());

      const observedAt = new Date();
      observedAt.setHours(hour, 0, 0, 0);

      results.push({
        observed_at: observedAt.toISOString(),
        area: TARGET_AREA,
        temperature: temp,
        wind_speed: wind,
        precipitation: prec,
      });
    });
  }

  // データが1件も取れなかった場合はエラー
  if (results.length === 0) {
    throw new Error(
      "weathernews.jp からデータを解析できませんでした。" +
        "HTML構造が変わった可能性があります。" +
        "USE_MOCK_DATA=true を設定してモックデータで動作確認することをおすすめします。"
    );
  }

  return results;
}

// ==============================
// エントリーポイント（外部から呼び出す関数）
// ==============================

/**
 * fetchWeatherData - 環境変数に応じてモック or 実データを返す
 *
 * API Route（collect/route.ts）はこの関数だけを呼び出す。
 * 「どこからデータを取るか」の切り替えをここで一元管理している。
 *
 * USE_MOCK_DATA=true  → fetchMockWeatherData()  （テスト・開発用）
 * USE_MOCK_DATA=false → fetchWeatherFromWeatherNews()  （本番用）
 */
export async function fetchWeatherData(): Promise<WeatherData[]> {
  const useMock = process.env.USE_MOCK_DATA === "true";

  if (useMock) {
    console.log("[weather] モックデータを使用します (USE_MOCK_DATA=true)");
    return fetchMockWeatherData();
  }

  console.log(`[weather] weathernews.jp からデータを取得します: ${WEATHERNEWS_URL}`);
  return fetchWeatherFromWeatherNews();
}
