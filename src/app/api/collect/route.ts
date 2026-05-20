/**
 * /api/collect - 天気データ収集エンドポイント
 *
 * なぜAPI Routeを使うのか？
 * - ブラウザ（クライアント）から直接Supabaseにアクセスすると、
 *   シークレットキーが漏れるリスクがある
 * - API Route（サーバーサイド）を経由することで、DBへの直接アクセスを隠蔽できる
 * - Vercel Cronはこのエンドポイントを定期的に呼び出すことで自動実行を実現する
 *
 * なぜVercel Cronを使うのか？
 * - サーバーレス環境（Vercel）では常駐プロセスが存在しないため、
 *   crontab のような伝統的な定期実行ができない
 * - Vercel Cronを使うと、指定したスケジュールでAPIエンドポイントを叩いてくれる
 * - vercel.json に設定を書くだけで使えるため、インフラ管理が不要
 *
 * なぜupsertを使うのか？
 * - INSERT だけだと同じ observed_at + area のデータが既にある場合にエラーになる
 * - upsert（= INSERT ... ON CONFLICT DO NOTHING）を使うことで、
 *   「まだない → 挿入」「すでにある → 何もしない（or 更新）」を1回のSQLで処理できる
 * - これにより、何度同じデータを取得しても重複しない
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, WEATHER_RECORDS_TABLE } from "@/lib/supabase";
import { fetchWeatherData } from "@/lib/weather";
import { CollectApiResponse } from "@/types/weather";

/**
 * POST /api/collect
 *
 * 天気データを取得してSupabaseに保存する。
 * 呼び出し元：
 * 1. Vercel Cron（vercel.json で設定、1時間ごとに自動実行）
 * 2. 画面の「手動取得」ボタン（ユーザーが任意のタイミングで実行）
 *
 * Vercel CronはGETリクエストを送るが、手動ボタンはPOSTを送る。
 * 両方に対応するためGET/POSTどちらも受け付ける。
 */
export async function POST(req: NextRequest): Promise<NextResponse<CollectApiResponse>> {
  return handleCollect(req);
}

export async function GET(req: NextRequest): Promise<NextResponse<CollectApiResponse>> {
  // Vercel Cron からのリクエストか確認（本番環境のみ）
  // CRON_SECRET を設定することで、不正なリクエストからAPIを保護できる
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

/**
 * 天気データ収集の実処理
 * GET/POST で共通のロジックを使うために関数として分離している
 */
async function handleCollect(_req: NextRequest): Promise<NextResponse<CollectApiResponse>> {
  try {
    // Step 1: 天気データを取得（モック or 実データ）
    console.log("[collect] 天気データ取得開始");
    const weatherDataList = await fetchWeatherData();
    console.log(`[collect] ${weatherDataList.length} 件のデータを取得しました`);

    if (weatherDataList.length === 0) {
      return NextResponse.json({
        success: true,
        message: "取得できるデータがありませんでした",
        inserted: 0,
      });
    }

    // Step 2: Supabaseにupsertで保存
    //
    // なぜobserved_atとareaにUNIQUE制約をつけるのか？
    // - 「1時間ごとの気象データ」は、同じ日時・同じ地域のデータが
    //   複数存在することに意味がない（むしろバグ・データ汚染になる）
    // - Cronが1時間ごとに動くが、何らかの理由で2回実行されることもある
    //   （リトライ、手動実行など）
    // - UNIQUE制約があることで、重複データが物理的にDBに入らないことを保証できる
    //
    // upsert の onConflict: "observed_at,area" の意味：
    // - (observed_at, area) の組み合わせが既存レコードと重複した場合、
    //   ignoreDuplicates: true なので「何もしない（スキップ）」
    const { data, error } = await supabase
      .from(WEATHER_RECORDS_TABLE)
      .upsert(weatherDataList, {
        onConflict: "observed_at,area",
        ignoreDuplicates: true, // 重複する場合は上書きせず無視
      })
      .select();

    if (error) {
      console.error("[collect] Supabase upsert エラー:", error);
      return NextResponse.json(
        {
          success: false,
          error: `データベースへの保存に失敗しました: ${error.message}`,
        },
        { status: 500 }
      );
    }

    const insertedCount = data?.length ?? 0;
    console.log(`[collect] ${insertedCount} 件を新規保存しました（重複はスキップ）`);

    return NextResponse.json({
      success: true,
      message: `${insertedCount} 件のデータを保存しました（重複はスキップ済み）`,
      inserted: insertedCount,
    });
  } catch (err) {
    // 予期しないエラー（ネットワークエラー、スクレイピング失敗など）
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[collect] 予期しないエラー:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: `データ収集中にエラーが発生しました: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
