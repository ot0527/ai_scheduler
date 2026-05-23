# テーブル設計（Phase 1）

> 最終更新: 2026年5月  
> マイグレーション: [`supabase/migrations/20260522000000_phase1_schema.sql`](../supabase/migrations/20260522000000_phase1_schema.sql)  
> TypeScript 型: [`packages/core/src/database-types.ts`](../packages/core/src/database-types.ts)

Phase 1 で実装済みの DB スキーマを、**テーブルの役割・カラム・画面との対応**が分かる形でまとめたドキュメントです。

---

## 1. 全体像

### 1.1 テーブル一覧（Phase 1 実装済み）

| テーブル | 日本語での役割 | 主な画面 |
| --- | --- | --- |
| `auth.users` | 認証ユーザー（Supabase 管理） | （ログイン基盤） |
| `profiles` | プロフィール（名前・タイムゾーン） | 将来の設定画面 |
| `user_preferences` | 基本設定（起床・就寝・作業上限など） | オンボーディング、基本設定 |
| `life_routines` | 生活リズム（食事・風呂など） | 生活リズム |
| `fixed_schedules` | 固定予定（仕事・学校など） | 固定予定 |
| `routine_day_overrides` | **今日だけ変更**（当日上書き） | ホーム「今日だけ変更」 |

### 1.2 未実装（Phase 2 以降）

企画書第13章で定義。現時点では **テーブルもマイグレーションも存在しません**。

| テーブル（予定） | 役割 |
| --- | --- |
| `goals` | 長期目標 |
| `goal_components` | 目標の構成要素 |
| `work_block_templates` | 作業ブロックテンプレート |
| `goal_budgets` | 週次・日次の時間予算 |
| `schedules` | 日別スケジュール |
| `user_ai_settings` | AI プロバイダ設定 |
| `ai_request_logs` | AI 呼び出しログ |

---

## 2. ER 図（Phase 1）

```mermaid
erDiagram
  auth_users ||--|| profiles : "1:1"
  auth_users ||--|| user_preferences : "1:1"
  auth_users ||--o{ life_routines : "1:N"
  auth_users ||--o{ fixed_schedules : "1:N"
  auth_users ||--o{ routine_day_overrides : "1:N"
  life_routines ||--o{ routine_day_overrides : "0:N"

  auth_users {
    uuid id PK
    text email
  }

  profiles {
    uuid id PK_FK
    text name
    text timezone
    timestamptz created_at
    timestamptz updated_at
  }

  user_preferences {
    uuid id PK
    uuid user_id UK_FK
    time wake_time_weekday
    time wake_time_weekend
    time sleep_time_weekday
    time sleep_time_weekend
    int max_session_minutes
    text_array focus_times
  }

  life_routines {
    uuid id PK
    uuid user_id FK
    routine_type type
    time preferred_time
    time earliest_time
    time latest_time
    int duration_minutes
  }

  fixed_schedules {
    uuid id PK
    uuid user_id FK
    text title
    time start_time
    time end_time
    int_array days_of_week
  }

  routine_day_overrides {
    uuid id PK
    uuid user_id FK
    date target_date
    override_target_type target_type
    uuid life_routine_id FK_nullable
    override_action action
    time preferred_time
  }
```

---

## 3. 画面 → テーブル対応（よく迷うポイント）

| UI の操作 | 書き込むテーブル | 主なカラム |
| --- | --- | --- |
| オンボーディング（起床・就寝） | `user_preferences` | `wake_time_weekday`, `sleep_time_weekday` など |
| 基本設定 | `user_preferences` | 同上 + `focus_times`, `max_session_minutes` |
| 生活リズムの登録 | `life_routines` | `type`, `preferred_time`, `duration_minutes` |
| 固定予定の登録 | `fixed_schedules` | `title`, `start_time`, `end_time`, `days_of_week` |
| 今日だけ変更 → **起床** | `routine_day_overrides` | `target_type='wake'`, `preferred_time` |
| 今日だけ変更 → **就寝** | `routine_day_overrides` | `target_type='sleep'`, `preferred_time` |
| 今日だけ変更 → **生活リズム** | `routine_day_overrides` | `target_type='routine'`, `life_routine_id`, `preferred_time` |

> **注意**: 就寝の「今日だけ変更」は `user_preferences.sleep_time_*` には書き込まれません。  
> `routine_day_overrides` の `target_type = 'sleep'` + `preferred_time` を参照してください。

---

## 4. ENUM 型

| 型名 | 値 | 用途 |
| --- | --- | --- |
| `routine_type` | `breakfast`, `lunch`, `dinner`, `bath`, `break`, `other` | 生活リズムの種類 |
| `applies_to_type` | `weekday`, `weekend`, `both` | 生活リズムの適用日 |
| `flexibility_type` | `fixed`, `flexible` | 生活リズムの柔軟性 |
| `override_target_type` | `wake`, `sleep`, `routine` | 今日だけ変更の対象 |
| `override_action` | `skip`, `modify` | スキップ or 時間変更 |

---

## 5. テーブル詳細

### 5.1 `profiles`

ユーザーの表示名とタイムゾーン。

| カラム | 型 | NULL | デフォルト | 説明 |
| --- | --- | --- | --- | --- |
| `id` | UUID | NO | — | PK。`auth.users.id` と 1:1 |
| `name` | TEXT | YES | — | 表示名 |
| `timezone` | TEXT | NO | `'Asia/Tokyo'` | IANA タイムゾーン |
| `created_at` | TIMESTAMPTZ | NO | `now()` | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | 更新日時（トリガーで自動更新） |

**作成タイミング**: `auth.users` への INSERT 時、`handle_new_user` トリガーで自動作成。

**RLS**: SELECT / UPDATE のみ（本人 `id = auth.uid()`）。

---

### 5.2 `user_preferences`

スケジュール計算の前提となる基本設定。**ユーザー 1 人につき 1 行**（`user_id` UNIQUE）。

| カラム | 型 | NULL | デフォルト | 説明 |
| --- | --- | --- | --- | --- |
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `user_id` | UUID | NO | — | FK → `auth.users.id`（UNIQUE） |
| `focus_times` | TEXT[] | NO | `'{}'` | 集中しやすい時間帯（`morning` 等） |
| `max_session_minutes` | INTEGER | NO | `60` | 1 回あたりの作業可能時間（分） |
| `wake_time_weekday` | TIME | YES | — | 平日の起床時刻 |
| `wake_time_weekend` | TIME | YES | — | 休日の起床時刻 |
| `sleep_time_weekday` | TIME | YES | — | 平日の就寝時刻 |
| `sleep_time_weekend` | TIME | YES | — | 休日の就寝時刻 |
| `break_frequency_minutes` | INTEGER | YES | — | 休憩の頻度（分）※ Phase 1 UI 未使用 |
| `break_duration_minutes` | INTEGER | YES | — | 休憩の長さ（分）※ Phase 1 UI 未使用 |
| `created_at` | TIMESTAMPTZ | NO | `now()` | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | 更新日時 |

**オンボーディング完了判定**: `wake_time_weekday` と `sleep_time_weekday` が両方 NULL でないこと。

**RLS**: SELECT / INSERT / UPDATE / DELETE（本人 `user_id = auth.uid()`）。

---

### 5.3 `life_routines`

食事・風呂など、日によって前後する生活予定。

| カラム | 型 | NULL | デフォルト | 説明 |
| --- | --- | --- | --- | --- |
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `user_id` | UUID | NO | — | FK → `auth.users.id` |
| `type` | `routine_type` | NO | — | 種類（朝食/夕食/風呂 等） |
| `label` | TEXT | YES | — | カスタム表示名（任意） |
| `preferred_time` | TIME | NO | — | 希望時刻（「ごろ」の中心） |
| `earliest_time` | TIME | NO | — | 最早許容時刻 |
| `latest_time` | TIME | NO | — | 最遅許容時刻 |
| `duration_minutes` | INTEGER | NO | — | 所要時間（1〜480 分） |
| `flexibility` | `flexibility_type` | NO | `'flexible'` | 固定 / 柔軟 |
| `applies_to` | `applies_to_type` | NO | `'both'` | 平日 / 休日 / 毎日 |
| `sort_order` | INTEGER | NO | `0` | 表示順 |
| `created_at` | TIMESTAMPTZ | NO | `now()` | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | 更新日時 |

**制約**: `earliest_time <= preferred_time <= latest_time`

**UI の「ごろ」入力**: `preferred_time` を中心に ±許容幅（デフォルト 30 分）で `earliest_time` / `latest_time` を自動算出して保存。

**RLS**: CRUD すべて本人限定。

---

### 5.4 `fixed_schedules`

仕事・学校など、曜日ごとに繰り返す固定予定。空き時間計算で **必ず除外** される。

| カラム | 型 | NULL | デフォルト | 説明 |
| --- | --- | --- | --- | --- |
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `user_id` | UUID | NO | — | FK → `auth.users.id` |
| `title` | TEXT | NO | — | タイトル（最大 200 文字） |
| `start_time` | TIME | NO | — | 開始時刻 |
| `end_time` | TIME | NO | — | 終了時刻 |
| `days_of_week` | INTEGER[] | NO | — | 曜日（0=日, 1=月, …, 6=土） |
| `commute_minutes` | INTEGER | NO | `0` | 移動時間（0〜180 分） |
| `is_editable` | BOOLEAN | NO | `false` | 編集可能フラグ |
| `created_at` | TIMESTAMPTZ | NO | `now()` | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | 更新日時 |

**制約**: `start_time < end_time`

**RLS**: CRUD すべて本人限定。

---

### 5.5 `routine_day_overrides`

**今日だけ変更**。特定日の起床・就寝・生活リズムを上書きする。

| カラム | 型 | NULL | デフォルト | 説明 |
| --- | --- | --- | --- | --- |
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `user_id` | UUID | NO | — | FK → `auth.users.id` |
| `target_date` | DATE | NO | — | 適用日（`YYYY-MM-DD`） |
| `target_type` | `override_target_type` | NO | — | `wake` / `sleep` / `routine` |
| `life_routine_id` | UUID | YES | — | FK → `life_routines.id`（routine 時のみ必須） |
| `action` | `override_action` | NO | — | `modify`（時間変更）/ `skip`（スキップ） |
| `preferred_time` | TIME | YES | — | 変更後の希望時刻 |
| `earliest_time` | TIME | YES | — | 最早許容（routine / wake / sleep で保存） |
| `latest_time` | TIME | YES | — | 最遅許容 |
| `duration_minutes` | INTEGER | YES | — | 所要時間（routine の modify 時） |
| `created_at` | TIMESTAMPTZ | NO | `now()` | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | 更新日時 |

**一意制約**: `(user_id, target_date, target_type, life_routine_id)` — 同じ日・同じ対象は 1 行のみ。

**参照制約**:

- `target_type = 'routine'` → `life_routine_id` 必須
- `target_type IN ('wake', 'sleep')` → `life_routine_id` は NULL

**計算ロジックでの使われ方**:

| target_type | action | 反映内容 |
| --- | --- | --- |
| `wake` | `modify` | 当日の起床時刻 → **`preferred_time`** |
| `sleep` | `modify` | 当日の就寝時刻 → **`preferred_time`** |
| `wake` / `sleep` | `skip` | Phase 1 では **未反映**（保存はされる） |
| `routine` | `modify` | 生活リズムの時刻・所要時間を上書き |
| `routine` | `skip` | その生活リズムを当日スキップ |

**日付の注意**: アプリは **ブラウザのローカル日付（JST 等）** で `target_date` を保存します。  
Supabase SQL Editor の `CURRENT_DATE` は **UTC** のため、日本時間の「今日」とずれることがあります。

**RLS**: CRUD すべて本人限定。

---

## 6. インデックス

| インデックス名 | テーブル | カラム |
| --- | --- | --- |
| `idx_profiles_id` | `profiles` | `id` |
| `idx_user_preferences_user_id` | `user_preferences` | `user_id` |
| `idx_life_routines_user_id` | `life_routines` | `user_id` |
| `idx_fixed_schedules_user_id` | `fixed_schedules` | `user_id` |
| `idx_routine_day_overrides_user_date` | `routine_day_overrides` | `user_id`, `target_date` |

---

## 7. トリガー・自動処理

| トリガー | 対象 | 動作 |
| --- | --- | --- |
| `on_auth_user_created` | `auth.users` INSERT 後 | `profiles` と `user_preferences` を自動作成 |
| `*_updated_at` | 各テーブル UPDATE 前 | `updated_at = now()` |

---

## 8. セキュリティ（RLS）

- `public` スキーマの **全 5 テーブル** で RLS 有効
- 原則: `auth.uid() = user_id`（`profiles` は `auth.uid() = id`）の行のみアクセス可
- UPDATE ポリシーは `USING` + `WITH CHECK` 両方を設定

---

## 9. 調査用 SQL 例

### ユーザー ID の取得

```sql
SELECT id, email FROM auth.users WHERE email = 'your@example.com';
```

### 基本設定の確認

```sql
SELECT wake_time_weekday, wake_time_weekend, sleep_time_weekday, sleep_time_weekend
FROM user_preferences
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your@example.com');
```

### 今日だけ変更（日付条件なし・全件）

```sql
SELECT target_date, target_type, action, preferred_time, life_routine_id
FROM routine_day_overrides
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your@example.com')
ORDER BY target_date DESC, target_type;
```

### 日本時間の「今日」で絞り込み

```sql
SELECT *
FROM routine_day_overrides
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your@example.com')
  AND target_date = (now() AT TIME ZONE 'Asia/Tokyo')::date;
```

---

## 10. 空き時間計算での参照順序

`packages/core/src/scheduling/free-time.ts` の処理順:

1. `user_preferences` から平日/休日の起床・就寝を取得
2. `routine_day_overrides` で当日の起床・就寝を上書き（`modify` のみ）
3. `fixed_schedules` をハードブロックとして除外
4. `life_routines` + 当日 override をブロックとして除外
5. 残りを空き時間スロットとして返却

---

## 11. 関連ドキュメント

| ファイル | 内容 |
| --- | --- |
| [`開発作業_引き継ぎ.md`](./開発作業_引き継ぎ.md) | 実装進捗・画面ルート |
| [`技術選定と実装方針.md`](./技術選定と実装方針.md) | フェーズ計画・将来テーブル |
| [`AI秘書スケジュール管理アプリ_詳細企画書_セキュリティ反映版.md`](./AI秘書スケジュール管理アプリ_詳細企画書_セキュリティ反映版.md) | 完成版の全テーブル定義（第13章） |
