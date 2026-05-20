/**
 * /api/weather - 保存済み天気データ取得エンドポイント
 *
 * DBに保存されているweather_recordsの一覧を返す。
 * フロントエンド（page.tsx）がこのAPIを呼び出してテーブル表示する。
 *
 * なぜAPI Routeを経由するのか？
 * - Supabase の Service Role Key をブラウザに公開しないため
 * - サーバー側でのみ DB アクセスすることでセキュリティを保つ
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, WEATHER_RECORDS_TABLE } from "@/lib/supabase";
import { WeatherApiResponse } from "@/types/weather";

/**
 * GET /api/weather
 *
 * クエリパラメータ:
 * - limit: 取得件数（デフォルト: 100、最大: 1000）
 * - area:  地域名でフィルタ（省略時は全地域）
 *
 * 例:
 * GET /api/weather              → 最新100件
 * GET /api/weather?limit=50     → 最新50件
 * GET /api/weather?area=千葉    → 千葉のデータのみ
 */
export async function GET(
  req: NextRequest
): Promise<NextResponse<WeatherApiResponse>> {
  // クエリパラメータを取得
  const { searchParams } = req.nextUrl;
  const limitParam = searchParams.get("limit");
  const areaParam = searchParams.get("area");

  // limit の検証（1〜1000の範囲に収める）
  const limit = Math.min(
    1000,
    Math.max(1, parseInt(limitParam || "100", 10) || 100)
  );

  try {
    // Supabase から天気データを取得
    // observed_at（観測日時）で降順ソート → 最新データが先頭に来る
    let query = supabase
      .from(WEATHER_RECORDS_TABLE)
      .select("id, observed_at, area, temperature, wind_speed, precipitation, created_at")
      .order("observed_at", { ascending: false })
      .limit(limit);

    // area フィルタが指定されている場合は絞り込む
    if (areaParam) {
      query = query.eq("area", areaParam);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[weather] Supabase 取得エラー:", error);
      return NextResponse.json(
        {
          success: false,
          error: `データの取得に失敗しました: ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data ?? [],
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[weather] 予期しないエラー:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: `サーバーエラーが発生しました: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
