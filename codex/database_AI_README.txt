# ScheduleCraft データベース設計書（Version 0.1）

## 1. 前提

本サービスは、イベントや団体活動向けのスケジュール・シフト自動作成サービスである。

想定DBは Supabase / PostgreSQL とする。

---

## 2. 主要エンティティ

* users
* groups
* group_members
* events
* event_slots
* availability
* shift_rules
* shift_generation_settings
* shifts
* shift_assignments
* invitations
* notifications

---

# 3. テーブル設計

---

## 3.1 users

ユーザー情報を管理する。

Supabase Auth の `auth.users` と連携する。

| カラム名         | 型         | 説明                    |
| ------------ | --------- | --------------------- |
| id           | uuid      | 主キー。auth.users.id と同じ |
| display_name | text      | 表示名                   |
| email        | text      | メールアドレス               |
| avatar_url   | text      | プロフィール画像URL           |
| provider     | text      | google / microsoft    |
| created_at   | timestamp | 作成日時                  |
| updated_at   | timestamp | 更新日時                  |

### 備考

* Google / Microsoft OAuthログイン時に作成する。
* 同一メールアドレスの場合は同一ユーザーとして扱う。

---

## 3.2 groups

グループ情報を管理する。

| カラム名              | 型         | 説明        |
| ----------------- | --------- | --------- |
| id                | uuid      | 主キー       |
| name              | text      | グループ名     |
| description       | text      | 説明        |
| icon_url          | text      | アイコンURL   |
| owner_id          | uuid      | 作成者ユーザーID |
| invite_code       | text      | 招待コード     |
| is_invite_enabled | boolean   | 招待リンクが有効か |
| created_at        | timestamp | 作成日時      |
| updated_at        | timestamp | 更新日時      |

### 関係

* `owner_id` → `users.id`

---

## 3.3 group_members

グループに所属するメンバーを管理する。

| カラム名      | 型         | 説明                     |
| --------- | --------- | ---------------------- |
| id        | uuid      | 主キー                    |
| group_id  | uuid      | グループID                 |
| user_id   | uuid      | ユーザーID                 |
| role      | text      | owner / admin / member |
| joined_at | timestamp | 参加日時                   |

### 関係

* `group_id` → `groups.id`
* `user_id` → `users.id`

### 制約

* `group_id + user_id` はユニークにする。
* role は `owner`, `admin`, `member` のみ。

---

## 3.4 events

イベント情報を管理する。

| カラム名                  | 型         | 説明                                                  |
| --------------------- | --------- | --------------------------------------------------- |
| id                    | uuid      | 主キー                                                 |
| group_id              | uuid      | 所属グループID                                            |
| name                  | text      | イベント名                                               |
| description           | text      | 説明                                                  |
| location              | text      | 開催場所                                                |
| start_date            | date      | 開始日                                                 |
| end_date              | date      | 終了日                                                 |
| availability_deadline | timestamp | 希望提出締切                                              |
| status                | text      | draft / collecting / generated / published / closed |
| created_by            | uuid      | 作成者                                                 |
| created_at            | timestamp | 作成日時                                                |
| updated_at            | timestamp | 更新日時                                                |

### 関係

* `group_id` → `groups.id`
* `created_by` → `users.id`

---

## 3.5 event_slots

イベント内の時間枠を管理する。

例：7月20日 9:00〜12:00 に3人必要。

| カラム名            | 型         | 説明     |
| --------------- | --------- | ------ |
| id              | uuid      | 主キー    |
| event_id        | uuid      | イベントID |
| date            | date      | 日付     |
| start_time      | time      | 開始時刻   |
| end_time        | time      | 終了時刻   |
| required_people | integer   | 必要人数   |
| location        | text      | 場所     |
| note            | text      | メモ     |
| created_at      | timestamp | 作成日時   |
| updated_at      | timestamp | 更新日時   |

### 関係

* `event_id` → `events.id`

---

## 3.6 availability

メンバーの参加可能日時を管理する。

| カラム名       | 型         | 説明                                  |
| ---------- | --------- | ----------------------------------- |
| id         | uuid      | 主キー                                 |
| event_id   | uuid      | イベントID                              |
| user_id    | uuid      | ユーザーID                              |
| date       | date      | 日付                                  |
| start_time | time      | 開始時刻                                |
| end_time   | time      | 終了時刻                                |
| status     | text      | available / unavailable / preferred |
| comment    | text      | コメント                                |
| created_at | timestamp | 作成日時                                |
| updated_at | timestamp | 更新日時                                |

### 関係

* `event_id` → `events.id`
* `user_id` → `users.id`

### 備考

* `preferred` は「できれば入りたい」などの希望を表す。
* 参加不可も明示的に保存できる。

---

## 3.7 shift_rules

シフト作成の基本ルールを管理する。

| カラム名                     | 型         | 説明                    |
| ------------------------ | --------- | --------------------- |
| id                       | uuid      | 主キー                   |
| event_id                 | uuid      | イベントID                |
| slot_minutes             | integer   | シフト単位。例：60 / 90 / 180 |
| min_work_minutes         | integer   | 1人あたり最低勤務時間           |
| max_work_minutes         | integer   | 1人あたり最大勤務時間           |
| max_continuous_minutes   | integer   | 最大連続勤務時間              |
| break_minutes            | integer   | 休憩時間                  |
| leader_required_per_slot | integer   | 各時間帯に必要なリーダー人数        |
| created_at               | timestamp | 作成日時                  |
| updated_at               | timestamp | 更新日時                  |

### 関係

* `event_id` → `events.id`

---

## 3.8 shift_generation_settings

自動生成時の最適化重みを管理する。

| カラム名                         | 型         | 説明               |
| ---------------------------- | --------- | ---------------- |
| id                           | uuid      | 主キー              |
| event_id                     | uuid      | イベントID           |
| preference_weight            | integer   | 希望反映の重み 0〜100    |
| fairness_weight              | integer   | 公平性の重み 0〜100     |
| balance_workload_weight      | integer   | 勤務時間均等化の重み 0〜100 |
| avoid_continuous_work_weight | integer   | 連続勤務回避の重み 0〜100  |
| leader_assignment_weight     | integer   | リーダー配置の重み 0〜100  |
| required_people_weight       | integer   | 必要人数達成の重み 0〜100  |
| created_at                   | timestamp | 作成日時             |
| updated_at                   | timestamp | 更新日時             |

### 関係

* `event_id` → `events.id`

### 制約

* 各 weight は 0〜100 の整数。

---

## 3.9 member_constraints

メンバーごとの制約・属性を管理する。

| カラム名             | 型         | 説明         |
| ---------------- | --------- | ---------- |
| id               | uuid      | 主キー        |
| event_id         | uuid      | イベントID     |
| user_id          | uuid      | ユーザーID     |
| is_leader        | boolean   | リーダーとして扱うか |
| min_work_minutes | integer   | 個別最低勤務時間   |
| max_work_minutes | integer   | 個別最大勤務時間   |
| note             | text      | メモ         |
| created_at       | timestamp | 作成日時       |
| updated_at       | timestamp | 更新日時       |

### 関係

* `event_id` → `events.id`
* `user_id` → `users.id`

---

## 3.10 fixed_assignments

固定シフトを管理する。

管理者が「この人はこの時間に必ず入れる」と指定するためのテーブル。

| カラム名       | 型         | 説明     |
| ---------- | --------- | ------ |
| id         | uuid      | 主キー    |
| event_id   | uuid      | イベントID |
| slot_id    | uuid      | 時間枠ID  |
| user_id    | uuid      | ユーザーID |
| reason     | text      | 固定理由   |
| created_at | timestamp | 作成日時   |

### 関係

* `event_id` → `events.id`
* `slot_id` → `event_slots.id`
* `user_id` → `users.id`

---

## 3.11 shifts

生成されたシフト全体を管理する。

1つのイベントに対して複数回生成できるようにする。

| カラム名                  | 型         | 説明                           |
| --------------------- | --------- | ---------------------------- |
| id                    | uuid      | 主キー                          |
| event_id              | uuid      | イベントID                       |
| version               | integer   | 生成バージョン                      |
| status                | text      | draft / published / archived |
| generated_by          | uuid      | 生成したユーザー                     |
| preference_score      | numeric   | 希望反映率                        |
| fairness_score        | numeric   | 公平性スコア                       |
| required_people_score | numeric   | 必要人数達成率                      |
| average_work_minutes  | integer   | 平均勤務時間                       |
| max_work_minutes      | integer   | 最大勤務時間                       |
| min_work_minutes      | integer   | 最小勤務時間                       |
| created_at            | timestamp | 作成日時                         |
| updated_at            | timestamp | 更新日時                         |

### 関係

* `event_id` → `events.id`
* `generated_by` → `users.id`

---

## 3.12 shift_assignments

実際のシフト割り当てを管理する。

| カラム名        | 型         | 説明            |
| ----------- | --------- | ------------- |
| id          | uuid      | 主キー           |
| shift_id    | uuid      | シフトID         |
| slot_id     | uuid      | 時間枠ID         |
| user_id     | uuid      | 担当者ID         |
| is_fixed    | boolean   | 固定割り当てか       |
| assigned_by | text      | auto / manual |
| created_at  | timestamp | 作成日時          |
| updated_at  | timestamp | 更新日時          |

### 関係

* `shift_id` → `shifts.id`
* `slot_id` → `event_slots.id`
* `user_id` → `users.id`

### 制約

* `shift_id + slot_id + user_id` はユニークにする。

---

## 3.13 invitations

招待リンク・招待コードを管理する。

| カラム名        | 型         | 説明     |
| ----------- | --------- | ------ |
| id          | uuid      | 主キー    |
| group_id    | uuid      | グループID |
| invite_code | text      | 招待コード  |
| created_by  | uuid      | 作成者    |
| expires_at  | timestamp | 有効期限   |
| is_active   | boolean   | 有効か    |
| created_at  | timestamp | 作成日時   |

### 関係

* `group_id` → `groups.id`
* `created_by` → `users.id`

---

## 3.14 notifications

通知を管理する。

| カラム名       | 型         | 説明                                      |
| ---------- | --------- | --------------------------------------- |
| id         | uuid      | 主キー                                     |
| user_id    | uuid      | 通知対象ユーザー                                |
| group_id   | uuid      | グループID                                  |
| event_id   | uuid      | イベントID                                  |
| type       | text      | deadline / published / updated / invite |
| title      | text      | 通知タイトル                                  |
| message    | text      | 通知本文                                    |
| is_read    | boolean   | 既読か                                     |
| created_at | timestamp | 作成日時                                    |

### 関係

* `user_id` → `users.id`
* `group_id` → `groups.id`
* `event_id` → `events.id`

---

# 4. ER構造

```text
users
 ├── group_members
 │    └── groups
 │         ├── events
 │         │    ├── event_slots
 │         │    ├── availability
 │         │    ├── shift_rules
 │         │    ├── shift_generation_settings
 │         │    ├── member_constraints
 │         │    ├── fixed_assignments
 │         │    └── shifts
 │         │         └── shift_assignments
 │         └── invitations
 └── notifications
```

---

# 5. 状態管理

## events.status

| 値          | 意味      |
| ---------- | ------- |
| draft      | 下書き     |
| collecting | 希望提出受付中 |
| generated  | シフト生成済み |
| published  | シフト公開済み |
| closed     | 終了      |

---

## shifts.status

| 値         | 意味      |
| --------- | ------- |
| draft     | 下書き     |
| published | 公開済み    |
| archived  | 過去バージョン |

---

## availability.status

| 値           | 意味        |
| ----------- | --------- |
| available   | 参加可能      |
| unavailable | 参加不可      |
| preferred   | できれば参加したい |

---

# 6. Supabase RLS 方針

## users

* 自分の情報のみ閲覧・編集可能
* 他ユーザーの基本情報は同じグループ所属時のみ閲覧可能

---

## groups

* 所属しているグループのみ閲覧可能
* 作成はログインユーザーなら可能
* 編集は owner / admin のみ
* 削除は owner のみ

---

## group_members

* 同じグループのメンバーは閲覧可能
* 権限変更は owner / admin のみ
* owner の削除は owner のみ

---

## events

* 所属グループのイベントのみ閲覧可能
* 作成・編集・削除は owner / admin のみ

---

## availability

* 自分の希望は作成・編集可能
* 管理者は同じイベントの全メンバーの希望を閲覧可能
* 他メンバーは原則閲覧不可

---

## shifts / shift_assignments

* 公開済みシフトは全メンバーが閲覧可能
* draft は owner / admin のみ閲覧可能
* 編集は owner / admin のみ

---

# 7. インデックス設計

以下のカラムにはインデックスを作成する。

```text
group_members.group_id
group_members.user_id
events.group_id
event_slots.event_id
availability.event_id
availability.user_id
shift_rules.event_id
shift_generation_settings.event_id
member_constraints.event_id
fixed_assignments.event_id
shifts.event_id
shift_assignments.shift_id
shift_assignments.slot_id
notifications.user_id
invitations.invite_code
```

---

# 8. MVPで必要なテーブル

最初に実装するテーブルは以下。

```text
users
groups
group_members
events
event_slots
availability
shift_rules
shift_generation_settings
shifts
shift_assignments
invitations
```

後回しにできるテーブル。

```text
notifications
member_constraints
fixed_assignments
```

---

# 9. 実装時の注意

* UUIDを主キーにする。
* `created_at` と `updated_at` は基本的に全テーブルに持たせる。
* 削除は基本的に物理削除ではなく、必要に応じて `deleted_at` を追加して論理削除にする。
* RLSを必ず有効化する。
* 権限判定は `group_members.role` を基準にする。
* 将来的な拡張を考え、イベント単位で設定を分離する。
* シフトは複数バージョンを保存できるようにする。
* 公開済みシフトと下書きシフトを明確に分ける。

---

# 10. Codexへの実装指示

この設計に基づいて、Supabase/PostgreSQL用のマイグレーションSQLを作成する。

要件：

* 全テーブルを作成する
* 主キーは uuid
* `created_at` は default now()
* `updated_at` は更新時に自動更新されるようにする
* 外部キー制約を設定する
* enum相当の CHECK 制約を設定する
* 必要なインデックスを作成する
* RLSを有効化する
* MVPに必要な基本ポリシーを作成する
* TypeScript側で使う型定義も生成しやすい命名にする
