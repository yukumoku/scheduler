# Group / Event Workspace Design

Alloca v2 では、`Group` を団体そのもの、`Event` をその中で動くプロジェクトとして扱う。

ただし、班と参加可能日時は **Group 直下ではなく Event 直下** に置く。

## 1. 結論

```text
Group
  ├─ GroupMember
  └─ Event
       ├─ Team
       │    └─ TeamMember
       ├─ AvailabilitySet
       │    └─ Availability
       ├─ EventTask
       │    └─ EventSlot
       │          └─ Shift
       └─ CalendarItem
```

## 2. Group の責務

`Group` は団体そのもの。

Group が持つもの:

- メンバー
- owner/admin 権限
- イベント一覧
- 招待情報

Group で決まるもの:

- だれが所属しているか
- だれが管理者か
- どのイベントが存在するか
- 団体全体の運用ルール

## 3. Event の責務

`Event` は Group 配下のプロジェクト。

Event が持つもの:

- イベント名
- 開催期間
- 場所
- 班
- 参加可能日時セット
- 作業
- 時間枠
- 生成されたシフト

Event で決まるもの:

- どの班があるか
- どの参加可能日時を使うか
- どの作業を行うか
- どの時間枠に何人必要か
- 生成・公開するシフト

## 4. Team の位置づけ

班は Event 内の運用単位。

例:

- 文化祭のロッカー班
- 文化祭の受付班
- 体育祭の整備班

班長は Event 内で班を管理する。

## 5. AvailabilitySet の位置づけ

参加可能日時は Event ごとに集める。

UI では「共通希望」ではなく「参加可能日時」と表現する。

`AvailabilitySet` は `team_id` を nullable にすることで、次を両立できる。

- Event 全体で使う参加可能日時
- 班ごとに個別で使う参加可能日時

## 6. UI 方針

### 6.1 Group Detail

Group Detail は、団体の入口として使う。

ここで見せるもの:

- イベント一覧
- メンバー
- 招待
- 統計

Group Detail では、班や参加可能日時の詳細編集は主役にしない。

### 6.2 Event Detail

Event Detail は、実務の主導線にする。

ここで扱うもの:

- 班
- 参加可能日時
- 作業
- 時間枠
- シフト

### 6.3 主要操作

- Group では「イベントを作る」
- Event では「班を作る」「参加可能日時を見る」「作業を作る」「時間枠を作る」「シフトを作る」

## 7. API 方針

作成・一覧取得は Event 経由を基本にする。

- `GET /api/groups/{group}/events`
- `POST /api/groups/{group}/events`
- `GET /api/events/{event}/teams`
- `GET /api/events/{event}/availability-sets`
- `GET /api/events/{event}/tasks`
- `GET /api/events/{event}/slots`

詳細・更新は Event 単体で扱う。

- `GET /api/events/{event}`
- `PATCH /api/events/{event}`

## 8. 権限方針

Group の権限を Event 操作の基準にする。

- owner/admin
  - Group 配下の全 Event を管理可能
  - 全 Team / AvailabilitySet / Shift を管理可能
- team leader
  - 自分の班に関係する作業・時間枠・シフトを管理可能
- member
  - 参加可能日時を提出
  - 自分のシフトを確認

## 9. 今後の実装注意

- Team と AvailabilitySet は Event 直下に置く
- Group 直下の班や参加可能日時は互換用途に限定する
- Event 詳細を、班・参加可能日時・作業・時間枠・シフトの主導線にする
