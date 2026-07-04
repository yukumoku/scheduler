# Alloca v2 Cleanup Targets

Version: 2.0 draft

この文書は、Alloca v2 へ移行する際に整理・削除・統合の対象となる機能をまとめたものである。

## 1. 削除候補

### 1.1 イベント別希望提出

削除候補:

- `EventAvailabilityController`
- `AvailabilityPage`
- イベント別希望提出 API
- イベント別希望提出 UI

理由:

- v2 の中心は `AvailabilitySet` であり、イベント別希望提出は別経路として重複しやすい
- 同じ参加可能日時を複数の経路で扱うと、集計・保存・表示ロジックが分岐して保守性が落ちる
- UI 上でも「どこで提出するのか」が分かりにくくなる

### 1.2 Group 直下の班・参加可能日時

移行対象:

- `Group` 直下の `Team`
- `Group` 直下の `CommonAvailabilitySet`

理由:

- 班はイベントのための運用単位であり、`Event` 直下のほうが自然
- 参加可能日時もイベントごとに使い回す前提のほうが、利用者の認識と合う

### 1.3 AI を前提にした自動生成寄りの実装

削除または非推奨候補:

- AI がシフトを最終生成する設計
- AI が DB を直接更新する設計

理由:

- v2 ではシフト生成はアルゴリズムが主担当
- AI は分析・提案・説明に限定する

### 1.4 カード過多の詳細 UI

削除または再設計候補:

- 一覧をカードで埋める詳細画面
- 画面内に多数の操作ボタンを並べる設計

理由:

- スマホで操作しづらい
- 長時間利用に向かない
- v2 の UI 方針に反する

## 2. 統合候補

### 2.1 参加可能日時

統合対象:

- `CommonAvailability`
- `CommonAvailabilitySet`
- イベント別希望提出の旧概念

方針:

- v2 では `AvailabilitySet` を正にする
- UI 名は `参加可能日時` に統一する
- `AvailabilitySet` は Event 配下に置き、必要なら team 単位でも作れるようにする

### 2.2 作業と時間枠

統合検討対象:

- `EventTask`
- `EventSlot`

方針:

- `Task` は作業単位
- `Slot` は時間枠単位
- `target_team_id` / `allow_cross_team_help` は Task 側に寄せる

### 2.3 集計・提出状況・分析

統合対象:

- 提出状況集計
- 希望反映率計算
- 不足枠判定
- 偏り分析

方針:

- `AvailabilitySummaryService` に集約する
- Controller から直接計算しない

## 3. 現行で残すもの

### 3.1 すぐに残す

- `Group`
- `GroupMember`
- `Event`
- `Shift`

### 3.2 事件ごとに残す

- `Team`
- `TeamMember`
- `AvailabilitySet`
- `Availability`
- `EventTask`
- `EventSlot`

### 3.3 当面残すが見直す

- `ShiftRule`
- `ShiftGenerationSetting`
- `ShiftAssignment`
- `Invitation`

理由:

- v2 の基盤として必要
- ただし将来的にカレンダーや Task 分離と再整理の余地がある

## 4. 今後保守性が悪化しやすい箇所

### 4.1 二重化した availability 系 API

- イベント別希望提出
- 参加可能日時提出

対策:

- 片方を正にして、もう片方は互換用途に限定する

### 4.2 画面ごとの個別集計

- 各 Controller 内の集計
- 各 Page 内の集計

対策:

- 共通 service / presenter を作る

### 4.3 `EventSlot` への責務集中

- 対象班
- 他班ヘルプ
- 時間帯
- 必要人数
- 作業意図

対策:

- `Task` を早期に導入し、責務を分ける

### 4.4 UI のカード乱立

- 重要度の低い情報までカード化
- 一覧がスクロールで埋まる

対策:

- 一覧はテーブル / リスト中心に統一する

## 5. 廃止判断の基準

次の条件を満たすものは廃止候補とする。

- 代替手段が v2 の中心にある
- ほぼ同じ情報を別経路で編集できる
- UI で利用者が迷いやすい
- 将来の拡張に悪影響が大きい
