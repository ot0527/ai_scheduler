# AI秘書スケジュール管理アプリ

長期目標・生活リズム・固定予定をもとに、日々の行動計画を作成・調整する AI 秘書型スケジュール管理 Web アプリです。

---

## この README の読み方

| やりたいこと                   | 参照セクション                                            |
| ------------------------------ | --------------------------------------------------------- |
| 初めてローカルで動かす         | [環境構築（初回セットアップ）](#環境構築初回セットアップ) |
| 毎日の開発（起動・テスト）     | [日常の開発](#日常の開発)                                 |
| コマンドの意味を知りたい       | [コマンド早見表](#コマンド早見表)                         |
| DB や Edge Function を変更した | [改修・デプロイ手順](#改修デプロイ手順)                   |
| 本番 DB のデータを確認したい   | [データベースの確認（SQL）](#データベースの確認sql)       |
| DB のデータを全部消して初期化  | [データの全削除（初期化）](#データの全削除初期化)         |
| エラーで困った                 | [トラブルシューティング](#トラブルシューティング)         |

設計の詳細は [基本設計書](docs/基本設計書.md) を参照してください。

---

## 前提条件

| ツール                                               | バージョン | 用途                                        |
| ---------------------------------------------------- | ---------- | ------------------------------------------- |
| [Node.js](https://nodejs.org/)                       | 20 以上    | フロント・ビルド                            |
| [pnpm](https://pnpm.io/)                             | 10 以上    | パッケージ管理（モノレポ）                  |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | 最新推奨   | DB マイグレーション・Edge Function デプロイ |
| Supabase アカウント                                  | —          | クラウド上の DB・認証・サーバーレス         |

### ツールのインストール

#### Windows

```powershell
# Node.js（winget を使う場合）
winget install OpenJS.NodeJS.LTS

# または nodejs.org からインストーラーをダウンロード

# pnpm
npm install -g pnpm

# Supabase CLI
npm install -g supabase
# または Scoop を使う場合
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### Ubuntu

```bash
# Node.js（nvm を使う場合）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# または NodeSource 公式リポジトリから
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm

# Supabase CLI
npm install -g supabase
```

---

## 技術スタック

| レイヤー       | 技術                                          |
| -------------- | --------------------------------------------- |
| フロントエンド | React 19, Vite, TypeScript, Tailwind CSS      |
| 状態管理       | TanStack Query                                |
| BaaS           | Supabase（Auth, PostgreSQL, RLS, Vault）      |
| サーバーレス   | Supabase Edge Functions（Deno）               |
| 共有ロジック   | `@ai-scheduler/core`（Zod, スケジューリング） |
| モノレポ       | pnpm workspaces, Turborepo                    |

---

## 環境構築（初回セットアップ）

### 1. リポジトリの取得と依存関係インストール

```bash
git clone <repository-url>
cd ai_scheduler
pnpm install
```

**`pnpm install` とは**: モノレポ内の全パッケージ（`apps/web`, `packages/core` 等）の依存ライブラリを一括インストールします。

### 2. Supabase プロジェクトの準備

1. [Supabase Dashboard](https://supabase.com/dashboard) で新規プロジェクトを作成
2. **Project Settings → General** から `Reference ID`（project-ref）を控える
3. **Project Settings → API** から `Project URL` と `anon` key（Publishable key）を控える
4. **Authentication → Users → Add user** で開発用ユーザーを 1 件作成（メール・パスワードを控える）

### 3. Supabase CLI でプロジェクトをリンク

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

| コマンド         | 説明                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `supabase login` | ブラウザで Supabase アカウントにログインし、CLI に認証情報を保存                                                  |
| `supabase link`  | ローカルの `supabase/` フォルダと、クラウド上の 1 プロジェクトを紐付け。**未 link だと `db push` 等が失敗します** |

`<your-project-ref>` は Dashboard の Reference ID（例: `abcdefghijklmnop`）。

### 4. データベースマイグレーションの適用

```bash
supabase db push
```

**`supabase db push` とは**: `supabase/migrations/` 内の SQL ファイルのうち、**まだクラウド DB に適用されていないもの**を順番に実行し、テーブル・RLS・トリガー等を作成・更新します。

Phase 0〜5 のマイグレーションが適用され、以下が作成されます（抜粋）:

- Phase 1: `profiles`, `user_preferences`, `life_routines`, `fixed_schedules`, `routine_day_overrides`
- Phase 2: `goals`, `goal_components`, `work_block_templates`, `user_ai_settings`, `ai_request_logs`
- Phase 3: `goal_budgets`, `schedules`, `scheduled_blocks`, `alerts`
- Phase 4〜5: 振り返りカラム、通知設定、Vault RPC 等
- セキュリティ強化: `user_ai_settings` のクライアント直接書き込み禁止、Vault RPC 所有者検証

適用状況は Dashboard の **Database → Migrations** でも確認できます。

#### 既に Phase 1 だけ適用済みの DB がある場合

`db push` が「既に存在する」等で失敗するとき:

```bash
supabase migration repair 20260522000000 --status applied
supabase db push
```

**`migration repair` とは**: 「このマイグレーションは既に適用済み」と CLI の履歴だけを修正します。DB の中身は変えません。

### 5. Edge Functions のデプロイ（AI・スケジュール生成を使う場合）

DB 適用後、サーバー側処理をクラウドに載せます。

```bash
pnpm --filter @ai-scheduler/core build

supabase functions deploy goal-decompose
supabase functions deploy goal-approve-decompose
supabase functions deploy ai-settings
supabase functions deploy budget-calculate
supabase functions deploy schedule-generate
supabase functions deploy schedule-reschedule-minor
supabase functions deploy reschedule-major
supabase functions deploy ai-chat
supabase functions deploy export-data
supabase functions deploy delete-account
```

**`supabase functions deploy <名前>` とは**: `supabase/functions/<名前>/` の TypeScript コードを Supabase 上にアップロードし、HTTPS で呼び出せるようにします。

**なぜ先に `core build` か**: Edge Function は `packages/core/dist` の共有ロジックを参照するため、ビルド成果物を最新にしておく必要があります。

**本番デプロイ時（任意）**: Edge Function の CORS を制限する場合、Supabase Dashboard → **Project Settings → Edge Functions → Secrets** に以下を設定します。

```env
ALLOWED_ORIGINS=https://your-production-domain.com
```

未設定時は `http://localhost:*` / `http://127.0.0.1:*` のみ許可されます（ローカル開発向け）。

### 6. フロントエンドの環境変数

#### Windows

```powershell
copy apps\web\.env.example apps\web\.env
```

#### Ubuntu

```bash
cp apps/web/.env.example apps/web/.env
```

`apps/web/.env` を編集:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

**認証について**: パスワード等の資格情報は `.env` に置きません。起動後、ブラウザのログイン画面からメールアドレスとパスワードでサインインします。セッションはブラウザの localStorage に保存され、ページを閉じてもログイン状態は維持されます（明示的にサインアウトするか、アカウント削除するまで）。

### 7. 開発サーバーの起動

```bash
pnpm --filter @ai-scheduler/core build
pnpm dev
```

ブラウザで http://localhost:5173 を開きます。

### 8. 動作確認（最小）

1. ログイン画面で、手順 2 で作成した開発用ユーザーでサインイン（または「新規登録」からアカウント作成）
2. 初回設定で起床・就寝時刻を入力
3. 「生活リズム」で夕食・風呂などを登録
4. 「固定予定」で仕事などを登録
5. ホームで今日の予定・空き時間を確認
6. （Phase 2 以降）目標登録 → AI 分解 → 時間予算 → スケジュール承認

---

## コマンド早見表

日常で使うコマンドと、その意味をまとめます。

### pnpm（パッケージ・スクリプト）

| コマンド                                 | 説明                                      |
| ---------------------------------------- | ----------------------------------------- |
| `pnpm install`                           | 依存ライブラリをインストール              |
| `pnpm dev`                               | 開発サーバーを起動（Turbo 経由で web 等） |
| `pnpm test`                              | `packages/core` のユニットテストを実行    |
| `pnpm typecheck`                         | TypeScript の型チェック                   |
| `pnpm --filter @ai-scheduler/core build` | 共有ロジックを `dist/` にビルド           |
| `pnpm --filter @ai-scheduler/web dev`    | Web アプリだけ起動                        |

**`--filter @ai-scheduler/core` とは**: モノレポの中の特定パッケージだけにコマンドを実行します。

### Supabase CLI（DB・サーバー）

| コマンド                                                | 説明                                               |
| ------------------------------------------------------- | -------------------------------------------------- |
| `supabase login`                                        | CLI を Supabase アカウントにログイン               |
| `supabase link --project-ref <ref>`                     | ローカルとクラウドプロジェクトを紐付け             |
| `supabase db push`                                      | 未適用マイグレーションをリモート DB に適用         |
| `supabase migration list`                               | ローカルとリモートのマイグレーション適用状況を表示 |
| `supabase migration repair <version> --status applied`  | 適用済みマイグレーションの履歴を手動修正           |
| `supabase functions deploy <name>`                      | Edge Function をクラウドにデプロイ                 |
| `supabase gen types typescript --linked > tmp-types.ts`（Windows）<br>`supabase gen types typescript --linked > /tmp/supabase-types.ts`（Ubuntu） | リンク済み DB から TypeScript 型を生成（参考用）   |

### ローカル Supabase（任意）

クラウドではなく PC 上に Supabase を立てる場合:

```bash
supabase start    # Docker でローカル Supabase 起動
supabase stop     # 停止
```

本プロジェクトの README 手順は **クラウドプロジェクト** を前提としています。

---

## 日常の開発

### 起動

```bash
pnpm --filter @ai-scheduler/core build   # core を変更した場合は必須
pnpm dev
```

### 変更内容別の作業

| 変更箇所                             | やること                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 画面・hooks のみ（`apps/web`）       | `pnpm dev` でホットリロード確認。デプロイはフロントのホスティング先に依存                                                   |
| 共有ロジック（`packages/core`）      | `pnpm test` → `pnpm --filter @ai-scheduler/core build` → web 再起動。Edge Function から使う場合は **functions も再 deploy** |
| DB スキーマ（`supabase/migrations`） | 新規 SQL ファイル追加 → `supabase db push` → `database-types.ts` / mapper 更新                                              |
| Edge Function                        | `core build` → `supabase functions deploy <name>`                                                                           |

### テスト・型チェック（コミット前推奨）

```bash
pnpm --filter @ai-scheduler/core build
pnpm typecheck
pnpm test
```

CI（GitHub Actions）でも同様のチェックが走ります。

---

## 改修・デプロイ手順

### A. 画面・UI の改修

1. `apps/web/src/` を編集
2. `pnpm dev` で動作確認
3. 必要なら `pnpm typecheck`

### B. スケジューリングロジックの改修（`packages/core`）

1. `packages/core/src/` を編集
2. テスト追加・更新: `pnpm --filter @ai-scheduler/core test`
3. ビルド: `pnpm --filter @ai-scheduler/core build`
4. Web で動作確認
5. Edge Function から当該ロジックを使っている場合は **該当 function を再 deploy**

**注意**: 非 AI 系 Edge Function は `dist/index.js` を import しないでください（`dist/scheduling/*.js` 等を直接 import）。詳細は [開発作業\_引き継ぎ §14](docs/開発作業_引き継ぎ.md) を参照。

### C. DB スキーマの改修

1. **新しいマイグレーション SQL を作成**（既存ファイルの直接編集は避ける）

   ```bash
   # ファイル名例（タイムスタンプ + 説明）
   supabase/migrations/20260528000000_add_example_column.sql
   ```

2. SQL を記述（テーブル追加・カラム追加・RLS ポリシー等）
3. 適用:

   ```bash
   supabase db push
   ```

4. 型・mapper を更新:
   - `packages/core/src/database-types.ts`
   - `packages/core/src/mappers/`（該当テーブル）
5. hooks / 画面を更新

型のたたき台生成:

**Windows:**

```powershell
supabase gen types typescript --linked > .\tmp-types.ts
# 出力を参考に database-types.ts を手動で更新（RLS やドメイン型は手動管理）
```

**Ubuntu:**

```bash
supabase gen types typescript --linked > /tmp/supabase-types.ts
# 出力を参考に database-types.ts を手動で更新（RLS やドメイン型は手動管理）
```

### D. Edge Function の改修

1. `supabase/functions/<name>/index.ts` または `_shared/` を編集
2. 共有ロジックを変えた場合:

   ```bash
   pnpm --filter @ai-scheduler/core build
   ```

3. デプロイ:

   ```bash
   supabase functions deploy <name>
   ```

4. Dashboard の **Edge Functions → Logs** でエラーを確認

**デプロイが必要な主なタイミング**

- `_shared/call-ai.ts`, `_shared/ai-utils.ts` を変更 → AI 系 function すべて
- `packages/core` の scheduling / ai を変更 → 参照している function すべて

### E. 本番反映前チェックリスト

```bash
pnpm --filter @ai-scheduler/core build
pnpm typecheck
pnpm test
supabase db push                    # 未適用マイグレーションがある場合のみ
supabase functions deploy <name>    # 変更した function のみ
```

---

## データベースの確認（SQL）

Supabase Dashboard の **SQL Editor**（`https://supabase.com/dashboard/project/<ref>/sql`）で実行します。

### SQL Editor の開き方

1. Dashboard で対象プロジェクトを開く
2. 左メニュー **SQL Editor** → **New query**
3. SQL を貼り付けて **Run**

Table Editor でも行の閲覧・編集はできますが、**カラム一覧や複数テーブル横断**は SQL の方が便利です。

### public スキーマのテーブル一覧

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### 特定テーブルのカラム一覧

`user_preferences` の例:

```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_preferences'
ORDER BY ordinal_position;
```

別テーブルを見るときは `table_name = 'goals'` のように変更します。

### テーブル定義のドキュメント

カラムの意味・画面との対応は [基本設計書\_テーブル設計.md](docs/基本設計書_テーブル設計.md) を参照してください。

### 開発用ユーザーの ID を取得

```sql
SELECT id, email, created_at
FROM auth.users
WHERE email = 'your-user@example.com';
```

以降のクエリではこの `id` を `user_id` として使います。

### 基本設定の確認

```sql
SELECT
  wake_time_weekday,
  wake_time_weekend,
  sleep_time_weekday,
  sleep_time_weekend,
  max_session_minutes,
  notification_settings
FROM user_preferences
WHERE user_id = '<ユーザー UUID>';
```

### 生活リズム・固定予定の確認

```sql
SELECT id, type, label, preferred_time, duration_minutes, applies_to
FROM life_routines
WHERE user_id = '<ユーザー UUID>'
ORDER BY sort_order;

SELECT id, title, start_time, end_time, days_of_week
FROM fixed_schedules
WHERE user_id = '<ユーザー UUID>';
```

### 当日変更（routine_day_overrides）の確認

**注意**: アプリはブラウザのローカル日付（JST 等）で `target_date` を保存します。SQL Editor の `CURRENT_DATE` は **UTC** のため、「今日」とずれることがあります。

```sql
-- 日本時間の「今日」で絞り込み
SELECT target_date, target_type, action, preferred_time, life_routine_id
FROM routine_day_overrides
WHERE user_id = '<ユーザー UUID>'
  AND target_date = (now() AT TIME ZONE 'Asia/Tokyo')::date;

-- 直近の変更をすべて見る
SELECT *
FROM routine_day_overrides
WHERE user_id = '<ユーザー UUID>'
ORDER BY target_date DESC, target_type;
```

### 目標・スケジュールの確認（Phase 2 以降）

```sql
SELECT id, title, status, deadline, completed_minutes, estimated_total_minutes
FROM goals
WHERE user_id = '<ユーザー UUID>'
ORDER BY created_at DESC;

SELECT target_date, status, approved_at, fatigue_level
FROM schedules
WHERE user_id = '<ユーザー UUID>'
ORDER BY target_date DESC
LIMIT 7;
```

### RLS（行レベルセキュリティ）の確認

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

`rowsecurity = true` であれば RLS が有効です。ポリシー内容は Dashboard の **Authentication → Policies** またはマイグレーション SQL を参照してください。

### マイグレーション適用履歴（DB 側）

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

CLI の `supabase migration list` と照合できます。

### データの全削除（初期化）

開発中に DB のデータをすべて消して、初回設定からやり直したいときに使います。

**注意**

- **取り消しできません**。必要なら先にアプリの **設定 → データの管理** から JSON エクスポートしてください
- 本番・開発で Supabase プロジェクトを共有している場合、本番データも消えます（現状は 1 プロジェクト構成）
- テーブル定義・RLS・マイグレーション履歴は残り、**行データだけ**が消えます

#### 方法 A: アプリから削除（1 アカウント分）

開発用ユーザーが 1 人だけのときはこちらが簡単です。

1. **設定 → データの管理**（`/settings/data`）を開く
2. 確認欄に **`削除する`** と入力して実行

Edge Function `delete-account` が Vault の API キー削除 → ユーザー削除（関連テーブルは CASCADE）まで行います。

#### 方法 B: SQL で全ユーザー一括削除

Supabase Dashboard の **SQL Editor** で実行します。

##### 手順 1（簡易・通常はこれで十分）

AI キーを登録していない、または Vault の残骸が残っても開発上問題ない場合:

```sql
DELETE FROM auth.users;
```

`auth.users` に紐づく public テーブルの行は **ON DELETE CASCADE** でまとめて削除されます。

##### 手順 2（AI API キーを Vault に保存している場合）

Vault 上の API キーも消したいときは、**先に** 以下を実行してから上記 `DELETE FROM auth.users` を実行します。

`user_ai_settings.api_key_ref` は **TEXT 型**ですが、`delete_user_api_key` は **UUID 型**の引数を取るため、`::uuid` でキャストが必要です。所有者検証のため **ユーザー ID** も渡します。

```sql
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT api_key_ref, user_id
    FROM public.user_ai_settings
    WHERE api_key_ref IS NOT NULL
  LOOP
    PERFORM public.delete_user_api_key(r.api_key_ref::uuid, r.user_id);
  END LOOP;
END $$;

DELETE FROM auth.users;
```

**消えるデータ（例）**

| 分類     | テーブル |
| -------- | -------- |
| 生活基盤 | `profiles`, `user_preferences`, `life_routines`, `fixed_schedules`, `routine_day_overrides` |
| 目標・AI | `goals`, `goal_components`, `work_block_templates`, `user_ai_settings`, `ai_request_logs` |
| 計画     | `goal_budgets`, `schedules`, `scheduled_blocks`, `alerts` |

#### 削除後の作業

1. Dashboard → **Authentication → Users → Add user** で開発用ユーザーを再作成（またはアプリのログイン画面から「新規登録」）
2. `pnpm dev` で起動し、ログイン画面からサインイン
3. 初回設定から入力し直す

新規ユーザー作成時、`handle_new_user` トリガーにより空の `profiles` と `user_preferences` が自動作成されます。

#### 削除後の確認

```sql
SELECT 'auth.users' AS tbl, count(*)::text AS rows FROM auth.users
UNION ALL SELECT 'goals', count(*)::text FROM public.goals
UNION ALL SELECT 'schedules', count(*)::text FROM public.schedules
UNION ALL SELECT 'life_routines', count(*)::text FROM public.life_routines;
```

すべて `0` ならデータは空です。

#### 特定ユーザーのデータだけ確認してから消す

削除前に、対象ユーザーのデータ量を確認できます。

```sql
-- メールアドレスから UUID を取得
SELECT id, email FROM auth.users WHERE email = 'your-user@example.com';

-- そのユーザーの主要データ件数（<ユーザー UUID> を置き換え）
SELECT 'goals' AS tbl, count(*) FROM public.goals WHERE user_id = '<ユーザー UUID>'
UNION ALL SELECT 'schedules', count(*) FROM public.schedules WHERE user_id = '<ユーザー UUID>'
UNION ALL SELECT 'life_routines', count(*) FROM public.life_routines WHERE user_id = '<ユーザー UUID>';
```

特定ユーザー 1 人だけ消す場合:

```sql
-- AI キー登録済みの場合のみ（未登録なら DELETE だけで可）
DO $$
DECLARE
  v_ref TEXT;
BEGIN
  SELECT api_key_ref INTO v_ref
  FROM public.user_ai_settings
  WHERE user_id = '<ユーザー UUID>' AND api_key_ref IS NOT NULL;

  IF v_ref IS NOT NULL THEN
    PERFORM public.delete_user_api_key(v_ref::uuid, '<ユーザー UUID>'::uuid);
  END IF;
END $$;

DELETE FROM auth.users WHERE id = '<ユーザー UUID>';
```

---

## プロジェクト構成

```text
ai_scheduler/
├── AGENTS.md                 # コーディング規約（実装前に必読）
├── README.md                 # 本ファイル
├── apps/web/                 # React フロントエンド
│   └── src/
│       ├── pages/            # 画面（16 画面）
│       ├── components/
│       ├── hooks/            # Supabase CRUD・React Query
│       └── lib/              # supabase クライアント, edge-functions 呼び出し
├── packages/core/            # 共有ドメインロジック
│   └── src/
│       ├── scheduling/       # 空き時間・予算・配置・リスケ
│       ├── ai/               # プロンプト・AI 出力検証
│       ├── schemas/          # Zod スキーマ
│       ├── mappers/          # DB 行 → ドメイン型
│       └── database-types.ts
├── supabase/
│   ├── migrations/           # DB マイグレーション（Phase 1〜5）
│   └── functions/            # Edge Functions（10 本 + _shared）
└── docs/                     # 企画書・基本設計書
```

| 処理                         | 置き場所                           |
| ---------------------------- | ---------------------------------- |
| 空き時間計算・バリデーション | `packages/core`                    |
| Supabase CRUD・React Query   | `apps/web/src/hooks`               |
| 画面・フォーム               | `apps/web/src/pages`, `components` |
| DB スキーマ                  | `supabase/migrations`              |
| AI 呼び出し・重い処理        | `supabase/functions`               |

---

## セキュリティ（概要）

- 全 public テーブルで RLS を有効化し、`auth.uid()` による本人データのみアクセス可
- クライアントには **anon key のみ**（service_role は Edge Function 内のみ）
- **認証資格情報（パスワード）はクライアントに埋め込まない**。ログイン画面から Supabase Auth でサインイン
- AI 用 API キーは **Vault** に暗号化保存（BYOK）。クライアントから AI プロバイダへ直接通信しない
- `user_ai_settings` の書き込み（API キー参照・使用量等）は **Edge Function（service_role）経由のみ**
- Vault RPC（`get_api_key_by_ref` / `delete_user_api_key`）は **所有者検証**付き
- Edge Function の CORS は `ALLOWED_ORIGINS` で制限（未設定時は localhost のみ）
- AI 出力・仮スケジュールはユーザー承認後にのみ DB へ反映

詳細は [基本設計書](docs/基本設計書.md) の非機能設計・セキュリティを参照。

---

## トラブルシューティング

### Supabase 接続エラー（フロント）

- `apps/web/.env` の URL / anon key が Dashboard **Project Settings → API** と一致しているか
- プロジェクトが pause していないか
- `.env` 変更後は `pnpm dev` を再起動

### ログイン・セッション

- 起動時にログイン画面が表示される。Dashboard **Authentication → Users** にユーザーが存在するか確認
- 新規登録時、Supabase プロジェクトで **メール確認が有効** だと確認リンクのクリックが必要な場合がある（開発中は Dashboard → Authentication → Providers → Email で「Confirm email」をオフにすると省略可能）
- 一度サインインするとセッションは localStorage に保存され、ブラウザを閉じても維持される
- ログアウトしたい場合はブラウザのサイトデータを消すか、アカウント削除（設定 → データの管理）を実行

### `supabase db push` が失敗する

| 症状                   | 対処                                                                        |
| ---------------------- | --------------------------------------------------------------------------- |
| `not linked`           | `supabase link --project-ref <ref>` を実行                                  |
| オブジェクトが既に存在 | `supabase migration repair <version> --status applied` の後、再度 `db push` |
| SQL エラー             | マイグレーション SQL を修正し、**新しい** migration ファイルで差分を適用    |

### `@ai-scheduler/core` が見つからない / 型エラー

```bash
pnpm --filter @ai-scheduler/core build
```

### Edge Function が 502 / バンドルエラー

- **`zod` / `date-fns` 解決失敗**: 非 AI 関数で `dist/index.js` を import していないか確認（[開発作業\_引き継ぎ §14](docs/開発作業_引き継ぎ.md)）
- **ロジック変更後**: `pnpm --filter @ai-scheduler/core build` → 該当 function を **再 deploy**
- Dashboard **Edge Functions → Logs** でスタックトレースを確認

### AI 分解・相談が失敗する

- AI 設定（`/settings/ai`）で API キーが Vault に保存されているか
- Gemini 無料枠の 429/403 → しばらく待つか OpenAI に切り替え
- `call-ai.ts` / 正規化ロジック変更後は `goal-decompose` / `ai-chat` 等を再 deploy

### データ全削除 SQL が失敗する

| エラー | 原因 | 対処 |
| --- | --- | --- |
| `function public.delete_user_api_key(text) does not exist` | 旧シグネチャで呼び出している | `delete_user_api_key(p_secret_id::uuid, p_user_id::uuid)` の **2 引数形式**を使う。または Vault 削除を省略して `DELETE FROM auth.users;` のみ実行 |
| `permission denied for function delete_user_api_key` | SQL Editor の実行ロールに権限がない | 簡易手順の `DELETE FROM auth.users;` のみ実行（Vault にキーが残るが開発用途では多くの場合問題なし） |

### データが「今日」と合わない（SQL Editor）

- `target_date` はアプリ側は JST 等のローカル日付。SQL では `(now() AT TIME ZONE 'Asia/Tokyo')::date` を使用

---

## ドキュメント

| 文書                                                                             | 内容                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------ |
| [基本設計書](docs/基本設計書.md)                                                 | システム概要・機能・非機能設計             |
| [基本設計書\_テーブル設計](docs/基本設計書_テーブル設計.md)                      | テーブル・カラム定義                       |
| [開発作業\_引き継ぎ](docs/開発作業_引き継ぎ.md)                                  | 実装進捗・Edge Function 詳細・既知の注意点 |
| [AGENTS.md](./AGENTS.md)                                                         | コーディング規約・レイヤー分担             |
| [技術選定と実装方針](docs/技術選定と実装方針.md)                                 | 技術選定理由                               |
| [詳細企画書](docs/AI秘書スケジュール管理アプリ_詳細企画書_セキュリティ反映版.md) | 機能要件・セキュリティ要件                 |
