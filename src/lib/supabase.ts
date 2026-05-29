import { createClient } from "@supabase/supabase-js";

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

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export const WEATHER_RECORDS_TABLE = "weather_records";
