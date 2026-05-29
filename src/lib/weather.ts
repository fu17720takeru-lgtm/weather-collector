import * as cheerio from "cheerio";
import { WeatherData } from "@/types/weather";

const TARGET_AREA = process.env.TARGET_AREA || "千葉";
const WEATHERNEWS_URL =
  process.env.WEATHERNEWS_URL ||
  "https://weathernews.jp/onebox/35.6054/140.1233/";

function parseNumber(str: string | undefined | null): number | null {
  if (!str) return null;
  const cleaned = str
    .replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .replace(/[℃°Cm\/s㎜mm\s　]/g, "")
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function truncateToHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

export async function fetchMockWeatherData(): Promise<WeatherData[]> {
  const now = new Date();
  const results: WeatherData[] = [];

  for (let hoursAgo = 0; hoursAgo < 24; hoursAgo++) {
    const observedAt = truncateToHour(
      new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)
    );
    const temperature = Math.round((15 + Math.random() * 10) * 10) / 10;
    const windSpeed = Math.round(Math.random() * 8 * 10) / 10;
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

export async function fetchWeatherFromWeatherNews(): Promise<WeatherData[]> {
  let html: string;
  try {
    const response = await fetch(WEATHERNEWS_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
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

  const $ = cheerio.load(html);
  const results: WeatherData[] = [];

  const tableRows = $("table tr, .forecast-table tr, .hourly tr");

  if (tableRows.length > 0) {
    const now = new Date();

    tableRows.each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length < 3) return;

      const timeText = $(cells[0]).text().trim();
      const tempText = $(cells[1]).text().trim();
      const windText = $(cells[2]).text().trim();
      const precipText = cells.length > 3 ? $(cells[3]).text().trim() : null;

      const hourMatch = timeText.match(/(\d{1,2})(?:時|:)/);
      if (!hourMatch) return;

      const hour = parseInt(hourMatch[1], 10);
      const observedAt = new Date(now);
      observedAt.setHours(hour, 0, 0, 0);
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

  if (results.length === 0) {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).text());
        if (json && json["@type"] === "WeatherForecast") {
          // JSON-LD形式のデータが見つかった場合の処理（サイト固有の実装が必要）
        }
      } catch {
        // ignore
      }
    });
  }

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

  if (results.length === 0) {
    throw new Error(
      "weathernews.jp からデータを解析できませんでした。HTML構造が変わった可能性があります。"
    );
  }

  return results;
}

export async function fetchWeatherData(): Promise<WeatherData[]> {
  if (process.env.USE_MOCK_DATA === "true") {
    return fetchMockWeatherData();
  }
  return fetchWeatherFromWeatherNews();
}
