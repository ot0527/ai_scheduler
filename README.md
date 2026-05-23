# AI秘書スケジュール管理アプリ

長期目標・生活リズム・固定予定をもとに、日々の行動計画を作成・調整する AI 秘書型スケジュール管理アプリです。

現在の実装範囲: **Phase 1**（生活リズム・固定予定・当日変更・空き時間計算）

## 機能（Phase 1）

- 初回オンボーディング（起床・就寝時間）
- 生活リズム CRUD（「ごろ」入力 → ±許容幅の自動変換）
- 固定予定 CRUD（曜日・移動時間対応）
- ホーム画面での今日の生活予定表示
- 当日変更（起床/就寝/生活リズムのスキップ・時間変更）
- 空き時間の自動計算

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| フロントエンド | React 19, Vite, TypeScript, Tailwind CSS |
| 状態管理 | TanStack Query |
| BaaS | Supabase（Auth, PostgreSQL, RLS） |
| 共有ロジック | `@ai-scheduler/core`（Zod, スケジューリング） |
| モノレポ | pnpm workspaces, Turborepo |

## 前提条件

- Node.js 20 以上
- pnpm 10 以上
- [Supabase CLI](https://supabase.com/docs/guides/cli)（マイグレーション適用用）
- [Supabase](https://supabase.com/) のアカウント（オンラインプロジェクト用）

## 環境構築

### 1. リポジトリのセットアップ

```bash
git clone <repository-url>
cd ai_scheduler
pnpm install
```

### 2. Supabase オンラインプロジェクトの作成

1. [Supabase Dashboard](https://supabase.com/dashboard) で新規プロジェクトを作成
2. **Project Settings → API** から `Project URL` と Publishable key（または anon key）を控える
3. **Authentication → Users → Add user** でアプリ用ユーザーを 1 件作成（メール・パスワードを控える）

### 3. データベースマイグレーションの適用

```bash
# Supabase CLI が未インストールの場合
npm install -g supabase

# Supabase にログインし、プロジェクトをリンク
supabase login
supabase link --project-ref <your-project-ref>

# マイグレーションをリモート DB に適用
supabase db push
```

`supabase/migrations/` 内の SQL により以下が作成されます:

- `profiles`, `user_preferences`, `life_routines`, `fixed_schedules`, `routine_day_overrides`
- 全テーブルへの RLS ポリシー
- 新規ユーザー作成時のプロフィール自動生成トリガー

### 4. フロントエンド環境変数

```bash
cp apps/web/.env.example apps/web/.env
```

`.env` に Supabase の接続情報と、手順 3 で作成したユーザーの資格情報を設定してください。

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<Publishable key または anon key>
VITE_SUPABASE_AUTH_EMAIL=<作成したユーザーのメール>
VITE_SUPABASE_AUTH_PASSWORD=<作成したユーザーのパスワード>
```

ログイン画面はありません。起動時に上記の資格情報で自動サインインします。

### 5. 開発サーバーの起動

```bash
# 共有パッケージをビルド
pnpm --filter @ai-scheduler/core build

# Web アプリを起動（http://localhost:5173）
pnpm dev
```

または個別に:

```bash
pnpm --filter @ai-scheduler/web dev
```

### 6. 動作確認

1. ブラウザで http://localhost:5173 を開く
2. オンボーディングで起床・就寝時間を入力
3. 「生活リズム」で夕食・風呂などを登録（例: 20:00 ごろ、30 分）
4. 「固定予定」で仕事などを登録（例: 9:00–18:00、月–金）
5. ホーム画面で今日の生活予定・空き時間・ブロック中の予定を確認
6. 「今日だけ変更」で生活リズムを変更し、空き時間が再計算されることを確認

## プロジェクト構成

```text
ai_scheduler/
├── apps/web/                 # React フロントエンド
├── packages/core/            # 共有ロジック（スケジューリング, Zod）
├── supabase/
│   ├── migrations/           # DB マイグレーション + RLS
│   └── config.toml
└── docs/                     # 企画書・技術選定
```

## 開発コマンド

```bash
# 全パッケージの開発サーバー
pnpm dev

# 型チェック
pnpm typecheck

# テスト（packages/core）
pnpm test

# 共有ロジックのビルド
pnpm --filter @ai-scheduler/core build

# Supabase Studio（DB GUI）: Dashboard の Table Editor / SQL Editor
```

## セキュリティ

Phase 1 時点で以下を実装済みです:

- 起動時の自動サインイン（RLS 用、ログイン UI なし）
- 全 public テーブルでの RLS 有効化
- `auth.uid()` による本人データのみアクセス可
- UPDATE ポリシーに `USING` + `WITH CHECK` を設定
- クライアントには anon key のみ（service_role 非露出）

## ドキュメント

- [開発作業 引き継ぎメモ](docs/開発作業_引き継ぎ.md) — 現在の進捗・構成・次 Phase への引き継ぎ
- [AGENTS.md](./AGENTS.md) — コーディング規約・レイヤー分担（**実装前に必読**）
- [詳細企画書（セキュリティ反映版）](docs/AI秘書スケジュール管理アプリ_詳細企画書_セキュリティ反映版.md)
- [技術選定と実装方針](docs/技術選定と実装方針.md)

## 今後のフェーズ

| Phase | 内容 |
| --- | --- |
| Phase 2 | 目標管理 + AI 分解 |
| Phase 3 | 時間予算 + 日次スケジュール生成 |
| Phase 4 | 実行記録・リスケジュール |
| Phase 5 | AI 相談・設定・データエクスポート |

## トラブルシューティング

### フロントエンドで Supabase 接続エラー

- `apps/web/.env` の URL / anon key が Dashboard の **Project Settings → API** と一致しているか確認
- Supabase プロジェクトが一時停止（pause）していないか確認

### セッション開始エラー

- `apps/web/.env` に `VITE_SUPABASE_AUTH_EMAIL` / `VITE_SUPABASE_AUTH_PASSWORD` が設定されているか確認
- Supabase Dashboard の **Authentication → Users** に該当ユーザーが存在するか確認
- 開発サーバー起動後に `.env` を変更した場合は `pnpm dev` を再起動

### マイグレーションエラー

```bash
supabase db push
```

で未適用のマイグレーションを再適用できます。スキーマの状態は Dashboard の **Database → Migrations** でも確認できます。

### 型エラー（`@ai-scheduler/core` が見つからない）

```bash
pnpm --filter @ai-scheduler/core build
```

を実行してから Web アプリを起動してください。
