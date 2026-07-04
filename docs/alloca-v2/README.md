# Alloca v2 Documentation

Alloca v2 は、団体向けのシフト・スケジュール管理プラットフォームとして再設計するための設計資料群です。

このフォルダの文書は、現行実装を v2 方針へ段階的に移行するための共通基盤になります。

## 設計思想

- 予定は一度だけ聞く
- シフトは何度でも作れる
- 参加可能日時を正にする
- シフト生成はアルゴリズムが担当する
- AI は分析・提案・説明に限定する
- UI はカード中心ではなく、リスト / テーブル / タブ中心にする

## ドキュメント一覧

- [Migration Roadmap](./migration-roadmap.md)
- [Cleanup Targets](./cleanup-targets.md)
- [Domain Model v2](./domain-model-v2.md)
- [Group / Event Workspace Design](./group-event-workspace.md)
- [Architecture](./architecture.md)

## 現在の最優先方針

1. `AvailabilitySet` を正にし、UI では `参加可能日時` と表現する
2. `AvailabilitySet` は `Event` 配下に置き、必要なら `Team` 単位のセットも作れるようにする
3. `Team` は `Event` 配下の運用単位として扱う
4. `EventTask` と `EventSlot` を分離する
5. `Group owner/admin` と `Team leader` の権限を分ける
6. UI をカード中心からリスト中心へ寄せる

### 補足

- `CommonAvailability` / `CommonAvailabilitySet` は移行名として残しつつ、新規設計では `Availability` / `AvailabilitySet` を使う
- 新しい集計は `AvailabilitySummaryService` に寄せる
- `EventSlot` は時間枠専用、作業条件は `EventTask` 側に寄せる
- `Event` は Group の中で作るプロジェクト単位、`Team` は Event の中で動く班として扱う
- `Group` 直下に班や参加可能日時を置くのは互換用途に限定し、v2 の主導線にはしない
- `Event` 詳細を、作業・時間枠・班・参加可能日時・シフトの主導線にする

## 今後の実装順序

以下の順番で進める。

1. 参加可能日時のイベント化
2. 班のイベント化
3. Task / Slot 分離
4. UI 整理
5. シフト生成
6. 共通カレンダー
7. AI Shift Assistant

## 開発時の注意

- 実装前にこの README を読む
- 既存機能を追加・修正する場合は、v2 方針と矛盾しないか確認する
- イベント別希望提出やカード過多の UI を新規に増やさない
- 新しく班や希望入力を作るときは、まず「Event 配下かどうか」を確認する
- 概念を増やす前に、まず既存の概念をどこに寄せるかを決める
