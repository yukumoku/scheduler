# Alloca v2 Domain Model

Version: 2.0 draft

Alloca v2 の情報設計を、実装方針に落とし込むためのドメインモデル定義である。

## 1. 設計原則

- 予定は一度だけ聞く
- シフトは何度でも作れる
- 参加可能日時を正にする
- 班はイベント内の管理単位として扱う
- 作業は `Task`、時間帯は `Slot` に分離する
- AI は分析・提案に限定する
- UI はテーブル / リスト / タブ中心にする

## 2. 中核概念

### 2.1 Group

団体そのもの。

例:

- 2年C組
- 文化祭実行委員会
- サークル
- ボランティア団体

Group が持つもの:

- メンバー
- owner/admin
- イベント一覧
- 招待

### 2.2 Event

Group の中で動くプロジェクト。

例:

- 文化祭
- 体育祭
- 準備期間のシフト

Event が持つもの:

- イベント名
- 開催期間
- 場所
- 班
- 参加可能日時セット
- 作業
- 時間枠
- シフト

### 2.3 Team

Event 内の班。

役割:

- `leader`
- `member`

### 2.4 AvailabilitySet

Event 単位で集める参加可能日時の単位。

UI 表現は「参加可能日時」にする。

`team_id` を nullable にすることで次を両立する。

- Event 全体で使う参加可能日時
- 班ごとに個別で使う参加可能日時

### 2.5 Availability

メンバーが提出する参加可能日時。

### 2.6 EventTask

イベント内の作業単位。

例:

- 装飾
- 受付
- リハーサル
- 撤収

### 2.7 EventSlot

Task に紐づく時間枠。

例:

- 7/20 9:00-12:00
- 必要人数 3人

### 2.8 Shift

時間枠へメンバーを割り当てた結果。

### 2.9 Shift Assistant

AI の役割名称。

Shift Assistant はシフトを生成するのではなく、生成結果を分析・説明・提案する。

### 2.10 CalendarItem / CalendarItemDTO

共通カレンダー用の統一表現。

将来的に次を扱う。

- グループ予定
- 班予定
- 会議
- 締切
- イベント
- シフト

## 3. 概念の関係

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

### 3.1 Group / Event の関係

`Group` と `Event` は並列ではない。

- `Group` は団体
- `Event` は Group 配下のプロジェクト
- `Team` と `AvailabilitySet` は Event 配下に置く

### 3.2 Team / AvailabilitySet の関係

班は Event 内で動く。

- 班長は Event 内の班リーダー
- 参加可能日時は Event 全体でも班ごとでも持てる
- 班ごとに別の参加可能日時を持たせたい場合は、同じ Event の中で team_id を使って分ける

### 3.3 Event / Task / Slot の関係

- `EventTask` は作業単位
- `EventSlot` は時間枠単位
- `EventSlot` は Task にだけ紐づく

## 4. 役割設計

### 4.1 Group 権限

- `owner`
- `admin`
- `member`

### 4.2 Team 権限

- `leader`
- `member`

### 4.3 権限ルール

- `group owner/admin`
  - Group 配下の全 Event を管理できる
  - 全 Team / AvailabilitySet / Shift を管理できる
- `team leader`
  - 自分の班に関係する作業・時間枠・シフトを管理できる
  - 班メンバーを管理できる
- `member`
  - 参加可能日時を提出できる
  - 自分の班 / 自分のシフトを閲覧できる

### 4.4 Owner の位置づけ

owner は必要である。

ただし、日々の運用は owner ではなく admin や leader に分散できるようにする。

- owner: 最終責任者
- admin: 運用管理者
- leader: 班運営者

## 5. Task 分離方針

### 5.1 役割分担

- `EventTask` は作業単位
- `EventSlot` は時間枠単位

### 5.2 結論

`target_team_id` と `allow_cross_team_help` は **Task 側に寄せる**。

理由:

- 「どの作業を誰向けにするか」は作業の意味だから
- 1 つの作業に複数 Slot を持たせやすいから
- 設定の重複を避けやすいから

### 5.3 Slot 側に残すもの

Slot 側に残すのは、純粋な時間情報と必要人数、状態である。

- start datetime
- end datetime
- required people
- status

## 6. Availability 統一方針

### 6.1 正のデータ

v2 では `AvailabilitySet` を正とする。

### 6.2 名前

UI では `参加可能日時` と表現する。

### 6.3 旧名称

- `CommonAvailabilitySet`
- `CommonAvailability`

は移行名として残してよいが、新規設計では `AvailabilitySet` / `Availability` を使う。

### 6.4 Event 別 Availability

方針:

- イベント別希望提出は廃止方向
- ただしイベント内の参加可能日時としては残す
- `AvailabilitySet` を Event 配下に置き、必要なら班単位のセットも作る

### 6.5 UI 方針

- イベント別希望提出導線は削除する
- 参加可能日時入力画面に統一する

## 7. シフトとヘルプ

### 7.1 他班ヘルプ

班を対象にした作業でも、不足時のみ他班のメンバーを候補にする。

### 7.2 優先順位

1. 参加可能な人のみ
2. 対象班メンバーを優先
3. 不足時のみ他班メンバーを候補
4. 班リーダーが必要な枠には leader を優先
5. 勤務時間の公平性
6. 希望反映率

### 7.3 シフト結果の表示

- 所属班外の割り当てには `ヘルプ` バッジ
- 班リーダーには `リーダー` バッジ

## 8. 共通カレンダー

### 8.1 目的

Alloca 内の予定を 1 つのカレンダーとして扱う。

### 8.2 設計上の注意

- 表示用 DTO と保存用モデルを分ける
- 外部連携 ID を持てるようにする
- 同期状態を別管理する

## 9. UI 方針

- カードは概要・統計のみ
- 一覧はテーブルまたはリスト
- 主要操作は 1 つ
- サブ操作はタブまたはメニュー
- スマホファースト
- 横スクロールは禁止

## 10. 将来の拡張に備えるポイント

- `Task` と `Slot` の責務分離
- `AvailabilitySet` のイベント化
- 共通カレンダーの統一 DTO
- AI と生成ロジックの分離
- 提出集計の service 化
- 権限判定の共通化
