import { NextRequest, NextResponse } from "next/server";
import { supabase, WEATHER_RECORDS_TABLE } from "@/lib/supabase";
import { fetchWeatherData } from "@/lib/weather";
import { CollectApiResponse } from "@/types/weather";

export async function POST(req: NextRequest): Promise<NextResponse<CollectApiResponse>> {
  return handleCollect(req);
}

export async function GET(req: NextRequest): Promise<NextResponse<CollectApiResponse>> {
  if (process.env.NODE_ENV === "production") {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  return handleCollect(req);
}

async function handleCollect(_req: NextRequest): Promise<NextResponse<CollectApiResponse>> {
  try {
    const weatherDataList = await fetchWeatherData();

    if (weatherDataList.length === 0) {
      return NextResponse.json({
        success: true,
        message: "取得できるデータがありませんでした",
        inserted: 0,
      });
    }

    const { data, error } = await supabase
      .from(WEATHER_RECORDS_TABLE)
      .upsert(weatherDataList, {
        onConflict: "observed_at,area",
        ignoreDuplicates: true,
      })
      .select();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: `データベースへの保存に失敗しました: ${error.message}`,
        },
        { status: 500 }
      );
    }

    const insertedCount = data?.length ?? 0;

    return NextResponse.json({
      success: true,
      message: `${insertedCount} 件のデータを保存しました（重複はスキップ済み）`,
      inserted: insertedCount,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    return NextResponse.json(
      {
        success: false,
        error: `データ収集中にエラーが発生しました: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
