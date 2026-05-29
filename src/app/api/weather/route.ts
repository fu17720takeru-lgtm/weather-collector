import { NextRequest, NextResponse } from "next/server";
import { supabase, WEATHER_RECORDS_TABLE } from "@/lib/supabase";
import { WeatherApiResponse } from "@/types/weather";

export async function GET(
  req: NextRequest
): Promise<NextResponse<WeatherApiResponse>> {
  const { searchParams } = req.nextUrl;
  const limitParam = searchParams.get("limit");
  const areaParam = searchParams.get("area");

  const limit = Math.min(
    1000,
    Math.max(1, parseInt(limitParam || "100", 10) || 100)
  );

  try {
    let query = supabase
      .from(WEATHER_RECORDS_TABLE)
      .select("id, observed_at, area, temperature, wind_speed, precipitation, created_at")
      .order("observed_at", { ascending: false })
      .limit(limit);

    if (areaParam) {
      query = query.eq("area", areaParam);
    }

    const { data, error } = await query;

    if (error) {
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

    return NextResponse.json(
      {
        success: false,
        error: `サーバーエラーが発生しました: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
