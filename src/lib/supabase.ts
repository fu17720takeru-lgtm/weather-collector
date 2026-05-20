/**
 * supabase.ts - Supabaseクライアントの初期化ファイル
 *
 * なぜSupabaseを使うのか？
 * - PostgreSQLをホスティングしてくれるサービスで、無料枠がある
 * - JavaScriptのSDKが充実しており、型安全にDB操作ができる
 * - Vercelと相性が良く、環境変数の設定も簡単
 * - RLS（Row Level Security）などのセキュリティ機能も内蔵されている
 *
 * なぜAPI Routeから呼び出すのか？
 * - Supabaseの「Service Role Key」は強力な権限を持つため、
 *   ブラウザ（クライアント）に公開してはいけない
 * - Next.jsのAPI Route（サーバーサイド）でのみ使用することで、
 *   シークレットキーを安全に管理できる
 */

import { createClient } from "@supabase/supabase-js";

// 環境変数のバリデーション
// .env.local に設定していない場合はビルド時にエラーを出して気づけるようにする
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "環境変数 NEXT_PUBLIC_SUPABASE_URL が設定されていません。.env.local を確認してください。"
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    "環境変数 SUPABASE_SERVICE_ROLE_KEY が設定されていません。.env.local を確認してください。"
  );
}

/**
 * Supabaseクライアント（サーバーサイド専用）
 *
 * Service Role Key を使うことで RLS（行レベルセキュリティ）をバイパスし、
 * すべてのDB操作が可能になる。
 * このファイルは API Route（サーバーサイド）からのみ import すること。
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * DB テーブル名の定数
 * テーブル名を1か所で管理することで、変更時の修正漏れを防ぐ
 */
export const WEATHER_RECORDS_TABLE = "weather_records";
