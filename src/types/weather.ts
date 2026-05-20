/**
 * weather.ts - 天気データの型定義ファイル
 *
 * TypeScript を使う理由：
 * - 型を明示することで、データ構造のミスを事前にコンパイルエラーとして検出できる
 * - チームで開発するときに「このデータ何が入るの？」という疑問がなくなる
 * - エディタの補完が効いて開発が速くなる
 */

/**
 * DBのweather_recordsテーブル1行分に対応する型
 * Supabaseから返ってくるデータはこの型を持つ
 */
export interface WeatherRecord {
  /** UUID形式の主キー */
  id: string;
  /** 観測日時（ISO 8601形式: "2025-05-20T10:00:00+09:00"） */
  observed_at: string;
  /** 地域名（例："千葉"） */
  area: string;
  /** 気温（℃）。データ取得できなかった場合は null */
  temperature: number | null;
  /** 風速（m/s）。データ取得できなかった場合は null */
  wind_speed: number | null;
  /** 降水量（mm）。データ取得できなかった場合は null */
  precipitation: number | null;
  /** このレコードをDBに保存した日時 */
  created_at: string;
}

/**
 * 天気サイトから取得して、DBに保存する直前のデータ型
 * idとcreated_atはDBが自動生成するので含まない
 */
export interface WeatherData {
  observed_at: string;
  area: string;
  temperature: number | null;
  wind_speed: number | null;
  precipitation: number | null;
}

/**
 * /api/weather のレスポンス型
 */
export interface WeatherApiResponse {
  success: boolean;
  data?: WeatherRecord[];
  error?: string;
}

/**
 * /api/collect のレスポンス型
 */
export interface CollectApiResponse {
  success: boolean;
  message?: string;
  inserted?: number;
  error?: string;
}
