# Alloca v2 設計書

Version: 2.0 draft

## 1. 目的

Alloca v2 は、団体向けのシフト・スケジュール管理プラットフォームとして再設計する。

中心思想は次の2つである。

- 予定は一度だけ聞く
- シフトは何度でも作れる

v2 では、参加可能日時をイベント単位で集め、その共通データをイベント、班、作業、時間枠、シフト生成、分析、提案に使い回す。

---

## 2. 基本方針

### 2.1 変更する考え方

- グループの直下に班や参加可能日時を置かない
- イベントごとに、必要な班と参加可能日時のセットを持つ
- 班ごとの独自希望が必要なら、イベント内の班単位で別セットを作れるようにする
- シフト生成は AI に丸投げせず、まずアルゴリズムで生成する
- AI は分析と提案に限定する
- 画面はカード中心ではなく、テーブル / リスト / タブで整理する

### 2.2 変わらない考え方

- グループの owner/admin は全体管理を担う
- 班の leader はイベント内の班運営を担う
- メンバーはスマホから短時間で入力する
- 公平性と希望反映率を重視する
- 将来の Google Calendar / Outlook 連携に備える

---

## 3. 用語定義

### 3.1 Group

団体そのもの。

例:

- 2年C組
- 文化祭実行委員会
- 体育祭実行委員会
- サークル

Group が持つもの:

- メンバー
- owner/admin 権限
- イベント一覧
- 招待情報

### 3.2 Event

Group の中で行うプロジェクト。

例:

- 文化祭
- 体育祭
- 準備期間のシフト

Event が持つもの:

- イベント名
- 開催期間
- 場所
- 参加可能日時のセット
- 班
- 作業
- 時間枠
- シフト

Event で決まるもの:

- どの参加可能日時セットを使うか
- どの班があるか
- どの作業を行うか
- どの時間枠に何人必要か
- 生成・公開するシフト

### 3.3 Team

Event 内の班。

例:

- ロッカー班
- 受付班
- 装飾班

Team には `leader` と `member` を持たせる。

### 3.4 AvailabilitySet

Event 単位で集める参加可能日時の単位。

UI 表現は「参加可能日時」にする。

`team_id` を nullable にすることで、次を両立する。

- Event 全体で使う参加可能日時
- 班ごとに個別で使う参加可能日時

### 3.5 Availability

メンバーが提出する参加可能日時。

### 3.6 EventTask

Event 内の作業単位。

例:

- 装飾
- 受付
- リハーサル
- 撤収

### 3.7 EventSlot

Task に紐づく時間枠。

例:

- 7/20 9:00-12:00
- 必要人数 3人

### 3.8 Shift

時間枠へメンバーを割り当てた結果。

### 3.9 Shift Assistant

AI の役割名称。

Shift Assistant はシフトを生成するのではなく、生成結果を分析・説明・提案する。

### 3.10 CalendarItem / CalendarItemDTO

共通カレンダー用の統一表現。

将来的に次を扱う。

- グループ予定
- 班予定
- 会議
- 締切
- イベント
- シフト

---

## 4. 概念の関係

```text
Group
  ├─ Event
  │    ├─ Team
  │    │    └─ TeamMember
  │    ├─ AvailabilitySet
  │    │    └─ Availability
  │    ├─ EventTask
  │    │    └─ EventSlot
  │    │          └─ Shift
  │    └─ CalendarItem
  └─ GroupMember
```

### 4.1 Group / Event の関係

`Group` と `Event` は並列ではない。

- `Group` は団体そのもの
- `Event` は Group 配下のプロジェクト
- `AvailabilitySet` と `Team` は Event 配下に置く

UI では Group Detail を入口にしつつ、実際の運用は Event Detail を主導線にする。

### 4.2 Team / AvailabilitySet の関係

班は Event の中で動く。

- 班長は Event 内の班リーダー
- 参加可能日時は Event 全体でも班ごとでも持てる
- 班ごとに別の参加可能日時を持たせたい場合は、同じ Event の中で team_id を使って分ける

### 4.3 Event / Task / Slot の関係

- `EventTask` は作業単位
- `EventSlot` は時間枠単位
- `EventSlot` は Task にだけ紐づく

---

## 5. 役割設計

### 5.1 Group 権限

- `owner`
- `admin`
- `member`

### 5.2 Team 権限

- `leader`
- `member`

### 5.3 権限ルール

- `group owner/admin`
  - Group 配下の全 Event を管理できる
  - 全 Team を管理できる
  - 全 AvailabilitySet を管理できる
  - 全 Shift を管理できる
- `team leader`
  - 自分の班に関係する作業・時間枠・シフトを管理できる
  - 班メンバーを管理できる
- `member`
  - 参加可能日時を提出できる
  - 自分の班 / 自分のシフトを閲覧できる

### 5.4 Owner の位置づけ

owner は必要である。

ただし、日々の運用は owner ではなく admin や leader に分散できるようにする。

- owner: 最終責任者
- admin: 運用管理者
- leader: 班運営者

---

## 6. UI 方針

- カードは概要と統計だけに使う
- 一覧はテーブルまたはリストにする
- 1 画面のカードは 4〜6 枚以内
- 主操作は 1 つだけ
- サブ操作はタブかメニューへ分離する
- スマホファースト
- 横スクロールは禁止

### 6.1 画面の主導線

- Group Detail
  - イベント一覧
  - メンバー
  - 招待
- Event Detail
  - 班
  - 参加可能日時
  - 作業
  - 時間枠
  - シフト

### 6.2 表示の優先順位

- 重要情報
  - イベント名
  - 班名
  - 参加可能日時の提出率
  - 不足枠
- それ以外
  - 補助情報としてタブやメニューに入れる

---

## 7. API設計

### 7.1 設計原則

- REST を基本にする
- レスポンス形式は `success / data / error` に統一する
- 認証済み API は `auth:sanctum` を前提とする
- 読み取り系と更新系を分ける

### 7.2 主要 API

#### 認証

- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /auth/google/redirect`
- `GET /auth/google/callback`
- `GET /auth/microsoft/redirect`
- `GET /auth/microsoft/callback`

#### グループ

- `GET /api/groups`
- `POST /api/groups`
- `GET /api/groups/{group}`
- `PATCH /api/groups/{group}`

#### イベント

- `GET /api/groups/{group}/events`
- `POST /api/groups/{group}/events`
- `GET /api/events/{event}`
- `PATCH /api/events/{event}`
- `DELETE /api/events/{event}`

#### 班

- `GET /api/events/{event}/teams`
- `POST /api/events/{event}/teams`
- `GET /api/teams/{team}`
- `PATCH /api/teams/{team}`
- `DELETE /api/teams/{team}`
- `GET /api/teams/{team}/members`
- `POST /api/teams/{team}/members`
- `PATCH /api/teams/{team}/members/{member}`
- `DELETE /api/teams/{team}/members/{member}`

#### 参加可能日時

- `GET /api/events/{event}/availability-sets`
- `POST /api/events/{event}/availability-sets`
- `GET /api/availability-sets/{set}`
- `PATCH /api/availability-sets/{set}`
- `DELETE /api/availability-sets/{set}`
- `GET /api/availability-sets/{set}/me`
- `PUT /api/availability-sets/{set}/me`
- `GET /api/availability-sets/{set}/submissions`

#### 作業 / 時間枠

- `GET /api/events/{event}/tasks`
- `POST /api/events/{event}/tasks`
- `PATCH /api/event-tasks/{task}`
- `DELETE /api/event-tasks/{task}`
- `GET /api/event-tasks/{task}/slots`
- `POST /api/event-tasks/{task}/slots`
- `POST /api/event-tasks/{task}/slots/bulk`
- `PATCH /api/event-slots/{slot}`
- `DELETE /api/event-slots/{slot}`

#### シフト

- `GET /api/events/{event}/shift-rules`
- `PUT /api/events/{event}/shift-rules`
- `GET /api/events/{event}/generation-settings`
- `PUT /api/events/{event}/generation-settings`
- `POST /api/events/{event}/shifts/generate`
- `GET /api/events/{event}/shifts`
- `GET /api/shifts/{shift}`
- `POST /api/shifts/{shift}/publish`

#### 共通カレンダー

- `GET /api/calendar`
- `POST /api/calendar/items`
- `PATCH /api/calendar/items/{item}`
- `DELETE /api/calendar/items/{item}`

---

## 8. DB設計

### 8.1 基本方針

- 主キーは UUID
- 全テーブルに `created_at` / `updated_at`
- 外部キー制約を必須にする
- 値の整合は enum と check 制約で担保する

### 8.2 主要テーブル

#### users

- `display_name`
- `avatar_url`
- `provider`
- `provider_id`

#### groups

- `name`
- `description`
- `icon_url`
- `owner_id`
- `invite_code`
- `is_invite_enabled`

#### group_members

- `group_id`
- `user_id`
- `role`
- `joined_at`

#### events

- `group_id`
- `team_id` nullable
- `availability_set_id` nullable
- `scope` = `group` / `team`
- `name`
- `description`
- `location`
- `start_date`
- `end_date`
- `availability_deadline`
- `status`
- `created_by`

#### teams

- `event_id`
- `name`
- `description`
- `color`

#### team_members

- `team_id`
- `user_id`
- `role`
- `joined_at`

#### availability_sets

- `event_id`
- `team_id` nullable
- `scope` = `event` / `team`
- `name`
- `description`
- `start_date`
- `end_date`
- `deadline`

#### availabilities

- `availability_set_id`
- `user_id`
- `date`
- `start_time`
- `end_time`
- `status`
- `comment`

#### event_tasks

- `event_id`
- `team_id` nullable
- `target_team_id` nullable
- `allow_cross_team_help` boolean default false
- `name`
- `description`
- `sort_order`

#### event_slots

- `task_id`
- `start_datetime`
- `end_datetime`
- `required_people`
- `status`

#### shifts

- `event_id`
- `status`
- `generated_at`
- `published_at`

#### shift_assignments

- `shift_id`
- `event_slot_id`
- `user_id`
- `is_leader`
- `is_help`

#### shift_rules

- `event_id`
- `slot_minutes`
- `min_work_minutes`
- `max_work_minutes`
- `max_continuous_minutes`
- `break_minutes`
- `leader_required_per_slot`

#### shift_generation_settings

- `event_id`
- `preference_weight`
- `fairness_weight`
- `balance_workload_weight`
- `avoid_continuous_work_weight`
- `leader_assignment_weight`
- `required_people_weight`

#### invitations

- `group_id`
- `invited_email`
- `invited_by`
- `token`
- `expires_at`
- `accepted_at`

---

## 9. シフト生成設計

### 9.1 シフト生成の考え方

- シフトはアルゴリズムが生成する
- AI は生成結果を評価して提案するだけ
- Event の `AvailabilitySet` を正として候補を決める
- EventTask の `target_team_id` / `allow_cross_team_help` をもとに候補を絞る

### 9.2 優先順位

1. 参加可能な人のみ
2. 対象班メンバーを優先
3. 不足時のみ他班メンバーを候補
4. 班リーダーが必要な枠には leader を優先
5. 勤務時間の公平性
6. 希望反映率

### 9.3 生成結果の表示

- 所属班外の割り当てには `ヘルプ` バッジ
- 班リーダーには `リーダー` バッジ

---

## 10. 共通カレンダー

### 10.1 目的

Alloca 内の予定を 1 つのカレンダーとして扱う。

### 10.2 設計上の注意

- 表示用 DTO と保存用モデルを分ける
- 外部連携 ID を持てるようにする
- 同期状態を別管理する

---

## 11. 今後の実装注意

- `Group` 直下の班 / 参加可能日時は legacy 互換として残してもよいが、新規設計の主導線にしない
- `Event` を Group から独立したトップレベル概念として増やさない
- Event 作成画面では必ず Group 文脈を明示する
- Event には AvailabilitySet 未設定の警告を表示する
- Global Events ページは横断確認用に限定する
