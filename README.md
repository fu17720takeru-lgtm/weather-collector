# Weather Data Collector

> **選考課題としての技術検証目的であり、実運用時は公式APIまたは許可された取得方法に置き換えてください。**

指定地域（千葉）の1時間ごとの気温・風速・降水量を [weathernews.jp](https://weathernews.jp) から取得し、Supabase PostgreSQLに保存・閲覧できるWebアプリです。

---

## 1. アプリ概要

| 項目 | 内容 |
|------|------|
| **目的** | 千葉地域の気象データを定期取得・蓄積して可視化する |
| **データ源** | weathernews.jp（HTMLスクレイピング / またはモックデータ） |
| **取得間隔** | 1時間ごと（Vercel Cron）または手動取得 |
| **保存先** | Supabase PostgreSQL |
| **画面** | データ一覧テーブル + 手動取得ボタン |

---

## 2. 使用技術

| 技術 | 役割 |
|------|------|
| **Next.js 15** | フロントエンド + バックエンドAPIを1プロジェクトで実現 |
| **React 19** | UIコンポーネント |
| **TypeScript** | 型安全なコーディング |
| **Supabase** | PostgreSQLのホスティング + JavaScriptクライアント |
| **Vercel** | ホスティング + 定期実行（Cron）|
| **Tailwind CSS** | ユーティリティファーストCSSフレームワーク |
| **cheerio** | サーバーサイドHTMLパース（スクレイピング用）|

---

## 3. 機能一覧

- [x] weathernews.jp から1時間ごとの気象データをスクレイピング
- [x] モックデータ（`USE_MOCK_DATA=true`）で動作確認
- [x] Supabase に気象データを保存（upsert で重複防止）
- [x] 保存済みデータをWebテーブルで閲覧
- [x] 手動取得ボタン（いつでも収集を実行可能）
- [x] データ更新ボタン（テーブルを最新化）
- [x] ローディング・エラー・データなし の各状態表示
- [x] Vercel Cron による1時間ごとの自動実行

---

## 4. DB設計

### `weather_records` テーブル

```sql
CREATE TABLE weather_records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at   TIMESTAMPTZ NOT NULL,                    -- 観測日時
  area          TEXT        NOT NULL,                    -- 地域名（例: 千葉）
  temperature   NUMERIC(5, 1),                           -- 気温（℃）
  wind_speed    NUMERIC(5, 1),                           -- 風速（m/s）
  precipitation NUMERIC(5, 1),                           -- 降水量（mm）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),      -- DB保存日時

  CONSTRAINT weather_records_observed_at_area_key
    UNIQUE (observed_at, area)                           -- 重複防止
);
```

### カラム説明

| カラム名 | 型 | 説明 |
|----------|----|------|
| `id` | UUID | 主キー（自動生成） |
| `observed_at` | TIMESTAMPTZ | 観測日時（タイムゾーン付き） |
| `area` | TEXT | 地域名 |
| `temperature` | NUMERIC(5,1) | 気温（℃）。取得不可時は NULL |
| `wind_speed` | NUMERIC(5,1) | 風速（m/s）。取得不可時は NULL |
| `precipitation` | NUMERIC(5,1) | 降水量（mm）。取得不可時は NULL |
| `created_at` | TIMESTAMPTZ | このレコードをDBに保存した日時 |

---

## 5. 重複防止の仕組み

`observed_at`（観測日時）と `area`（地域名）の組み合わせに **UNIQUE制約** を設けています。

### なぜUNIQUE制約をつけるのか

同じ日時・同じ地域の気象データは1件だけ存在すべきです。
Cronが1時間ごとに動く際、何らかの理由で2回実行された場合でも、
UNIQUE制約があることで**データベースレベルで重複を防止**できます。

### upsertによる処理

```typescript
// 重複する (observed_at, area) の組み合わせが来た場合は「何もしない」
await supabase
  .from("weather_records")
  .upsert(weatherDataList, {
    onConflict: "observed_at,area",
    ignoreDuplicates: true,  // 既存レコードがあればスキップ
  });
```

- **新しいデータ** → INSERT（挿入）
- **既存データ（同じ日時・地域）** → スキップ（エラーにしない）

---

## 6. 定期実行の仕組み

`vercel.json` に以下を設定することで、Vercel Cronが `/api/collect` を**1時間ごと**に自動で叩きます。

```json
{
  "crons": [
    {
      "path": "/api/collect",
      "schedule": "0 * * * *"
    }
  ]
}
```

- `"0 * * * *"` = 毎時0分に実行（cron記法）
- Vercel側のインフラが定期実行を管理するため、サーバーを常時起動する必要がない
- Vercel Pro以上のプランが必要（Hobbyプランは月1回まで）

---

## 7. 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase の Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase の Service Role Key（秘密） |
| `USE_MOCK_DATA` | - | `true` でモックデータを使用（デフォルト: `false`）|
| `TARGET_AREA` | - | 取得対象の地域名（デフォルト: `千葉`） |
| `WEATHERNEWS_URL` | - | weathernews.jp のURL（デフォルト: 千葉市の座標）|
| `CRON_SECRET` | - | Cronリクエストの認証トークン（推奨）|

---

## 8. Supabaseのテーブル作成SQL

Supabase ダッシュボードの **SQL Editor** で以下を実行してください。

```sql
-- weather_records テーブルを作成
CREATE TABLE IF NOT EXISTS weather_records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at   TIMESTAMPTZ NOT NULL,
  area          TEXT        NOT NULL,
  temperature   NUMERIC(5, 1),
  wind_speed    NUMERIC(5, 1),
  precipitation NUMERIC(5, 1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- observed_at + area の組み合わせが一意であることを保証
  CONSTRAINT weather_records_observed_at_area_key
    UNIQUE (observed_at, area)
);

-- インデックス: 日時降順でのソートを高速化
CREATE INDEX IF NOT EXISTS weather_records_observed_at_idx
  ON weather_records (observed_at DESC);

-- インデックス: 地域フィルタを高速化
CREATE INDEX IF NOT EXISTS weather_records_area_idx
  ON weather_records (area);

-- （任意）テスト用サンプルデータ
INSERT INTO weather_records (observed_at, area, temperature, wind_speed, precipitation)
VALUES
  (NOW() - INTERVAL '2 hours', '千葉', 22.5, 3.2, 0.0),
  (NOW() - INTERVAL '1 hour',  '千葉', 23.1, 2.8, 0.0),
  (NOW(),                       '千葉', 21.8, 4.1, 1.5)
ON CONFLICT (observed_at, area) DO NOTHING;
```

---

## 9. ローカル起動方法

### 前提条件

- Node.js 18以上がインストールされていること
- Supabase のアカウントとプロジェクトが作成済みであること

### 手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/your-username/weather-collector.git
cd weather-collector

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数ファイルを作成
cp .env.example .env.local

# 4. .env.local を編集して Supabase の情報を入力
#    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
#    SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxx

# 5. Supabase にテーブルを作成（「8. テーブル作成SQL」を実行）

# 6. 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

### 動作確認のポイント

- まず `USE_MOCK_DATA=true` で起動し、「手動でデータ取得」ボタンを押してテーブルにデータが表示されることを確認
- 確認後、`USE_MOCK_DATA=false` に変更してweathernews.jpからのデータ取得を試す

---

## 10. Vercelデプロイ方法

```bash
# 1. GitHubにリポジトリをpush
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/your-username/weather-collector.git
git push -u origin main

# 2. Vercel にデプロイ
#    - https://vercel.com にログイン
#    - "New Project" → GitHubのリポジトリを選択
#    - "Environment Variables" に以下を設定:
#      - NEXT_PUBLIC_SUPABASE_URL
#      - SUPABASE_SERVICE_ROLE_KEY
#      - USE_MOCK_DATA=false
#      - TARGET_AREA=千葉
#      - CRON_SECRET=（任意）
#    - "Deploy" をクリック
```

デプロイ後、Vercel ダッシュボードの **Cron Jobs** タブで定期実行の状態を確認できます。

---

## 11. 各ファイルの役割

```
weather-collector/
├── src/
│   ├── app/
│   │   ├── page.tsx               # メインページ（データ一覧＋操作UI）
│   │   ├── layout.tsx             # 全ページ共通レイアウト（<html>タグなど）
│   │   ├── globals.css            # TailwindのベーススタイルとグローバルCSS
│   │   └── api/
│   │       ├── weather/
│   │       │   └── route.ts       # GET /api/weather（DB からデータ取得）
│   │       └── collect/
│   │           └── route.ts       # POST|GET /api/collect（天気取得→DB保存）
│   ├── lib/
│   │   ├── supabase.ts            # Supabase クライアントの初期化
│   │   └── weather.ts             # 天気データ取得ロジック（モック＋実スクレイピング）
│   └── types/
│       └── weather.ts             # TypeScript 型定義
├── vercel.json                    # Vercel Cron の設定（1時間ごとに /api/collect を実行）
├── .env.example                   # 環境変数のテンプレート
├── .gitignore                     # Git 管理から除外するファイル
├── package.json                   # 依存パッケージと npm スクリプト
├── next.config.ts                 # Next.js 設定
├── tailwind.config.ts             # Tailwind CSS 設定
├── tsconfig.json                  # TypeScript コンパイラ設定
└── README.md                      # このファイル
```

---

## 12. 面接で聞かれた時の説明例

### Q. なぜ Next.js を選んだのですか？

> React のUIと、バックエンドのAPI（天気取得・DB保存）を1つのプロジェクトにまとめられるからです。
> 通常は「フロントエンド（React）」と「バックエンド（Express.js など）」を別々に作る必要がありますが、
> Next.js の **API Route** 機能を使えば `src/app/api/` フォルダにファイルを置くだけでAPIエンドポイントを作れます。
> また、Vercel との親和性が高く、`git push` するだけでデプロイ・ホスティング・Cronジョブまで自動で設定できます。

---

### Q. なぜ Supabase を選んだのですか？

> PostgreSQLをホスティングしてくれるサービスで、無料枠でも十分な機能が使えるからです。
> 公式の JavaScript SDK（`@supabase/supabase-js`）が充実しており、
> TypeScript との相性も良く、型安全にDB操作ができます。
> 自前でPostgreSQLサーバーを立てる必要がないため、インフラ管理コストを削減できます。

---

### Q. なぜ `observed_at` と `area` に UNIQUE 制約をつけたのですか？

> 「同じ日時・同じ地域の気象データは1件だけ存在すべき」というデータの一貫性を保つためです。
> Cronジョブが何らかの理由で2回実行されても、UNIQUE制約があることで**DBレベルで重複を防止**できます。
> アプリのコード側で重複チェックするより、DB制約に任せる方が確実で安全です。

---

### Q. upsert とはどういう処理ですか？

> "upsert" は "UPDATE + INSERT" の造語で、
> 「データが存在しなければ INSERT（挿入）、存在すれば UPDATE（更新）またはスキップ」という処理です。
> このアプリでは `ignoreDuplicates: true` を指定しているため、
> 重複データが来た場合は**スキップ（無視）** します。
> 通常の INSERT だと重複時にエラーになってしまいますが、upsert を使うことでエラーなく処理できます。

---

### Q. Vercel Cron はどのように動作しますか？

> `vercel.json` に cron スケジュールとエンドポイントを記述するだけで、
> Vercel のインフラが指定した時刻に自動でそのAPIを叩いてくれます。
> `"0 * * * *"` は「毎時0分に実行」という cron 記法です。
> 通常のサーバーでは `crontab` を設定しますが、
> Vercel のようなサーバーレス環境では常駐プロセスがないため、この仕組みを使います。

---

### Q. スクレイピングと公式APIの違いは何ですか？

> **スクレイピング** は Webサイトの HTML を直接解析してデータを取り出す方法で、
> サイトの HTML 構造が変わると動かなくなるリスクがあります。
> **公式API** はサービス提供者が正式に提供するデータ取得インターフェースで、
> 安定性・信頼性が高く、利用規約上も許可されています。
> 今回は技術検証目的でスクレイピングを実装しましたが、
> 実運用では公式APIへの移行を推奨します。

---

## 13. 今後の改善案

- [ ] **複数地域対応**: 千葉以外の地域も設定できるようにする（UI でプルダウン選択）
- [ ] **グラフ表示**: Chart.js や Recharts で気温の時系列グラフを追加
- [ ] **公式API移行**: OpenWeatherMap API や気象庁API に切り替えて安定性向上
- [ ] **アラート機能**: 気温や降水量が閾値を超えたらメール・Slack通知
- [ ] **データエクスポート**: CSV ダウンロード機能
- [ ] **認証機能**: Supabase Auth でログイン機能を追加
- [ ] **テスト追加**: Jest + Testing Library でユニットテストを整備
- [ ] **エラーモニタリング**: Sentry を導入してエラーを追跡
