# ScheduleCraft 技術仕様書（Version 0.1）

## 1. 技術方針

ScheduleCraftは、イベント・団体向けのスケジュール自動作成Webアプリケーションである。

本プロジェクトでは、バックエンドにLaravelを採用する。

理由：

* 認証機能を実装しやすい
* 権限管理を実装しやすい
* DB操作が分かりやすい
* Excel / CSV出力と相性が良い
* 管理画面・API・バッチ処理を作りやすい
* 将来的な機能拡張に向いている

---

## 2. 技術スタック

### Backend

* Laravel 13.x
* PHP 8.3以上
* PostgreSQL
* Laravel Sanctum
* Laravel Socialite
* Laravel Excel

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* TanStack Query
* React Hook Form
* Zod

### Auth

* Google OAuth
* Microsoft OAuth
* Laravel Socialite
* Laravel Sanctum

### Database

* PostgreSQL

### Export

* Excel: Laravel Excel
* CSV: Laravel標準レスポンスまたはLaravel Excel

### Development

* Docker
* Laravel Sail または独自Docker Compose
* GitHub
* GitHub Actions

---

## 3. アーキテクチャ

Laravel API + React SPA 構成を基本とする。

```text
React SPA
  ↓
Laravel API
  ↓
PostgreSQL
```

### 採用理由

* フロントエンドとバックエンドを分離しやすい
* API設計書と相性が良い
* 将来的にモバイルアプリ化しやすい
* Laravel側で認証・権限・DB・出力処理をまとめて管理できる

---

## 4. ディレクトリ構成

```text
app/
  Actions/
    Auth/
    Groups/
    Events/
    Availability/
    Shifts/
    Exports/

  Enums/
    GroupRole.php
    EventStatus.php
    ShiftStatus.php
    AvailabilityStatus.php

  Exports/
    ShiftExport.php

  Http/
    Controllers/
      Api/
        AuthController.php
        GroupController.php
        GroupMemberController.php
        InvitationController.php
        EventController.php
        EventSlotController.php
        AvailabilityController.php
        ShiftRuleController.php
        GenerationSettingController.php
        ShiftController.php
        ExportController.php

    Requests/
      Group/
      Event/
      Availability/
      Shift/

    Resources/
      UserResource.php
      GroupResource.php
      EventResource.php
      ShiftResource.php

  Models/
    User.php
    Group.php
    GroupMember.php
    Event.php
    EventSlot.php
    Availability.php
    ShiftRule.php
    ShiftGenerationSetting.php
    Shift.php
    ShiftAssignment.php
    Invitation.php

  Policies/
    GroupPolicy.php
    EventPolicy.php
    ShiftPolicy.php

  Services/
    ShiftGeneration/
      ShiftGenerator.php
      ShiftScoringService.php

routes/
  api.php
  web.php

database/
  migrations/
  seeders/

resources/
  js/
    components/
    features/
      auth/
      groups/
      events/
      availability/
      shifts/
      exports/
    pages/
    lib/
    types/
```

---

## 5. 認証仕様

### 対応ログイン

* Googleログイン
* Microsoftログイン

### 使用ライブラリ

* Laravel Socialite
* Microsoft用Socialite Provider
* Laravel Sanctum

### 認証フロー

```text
ユーザー
  ↓
Google / Microsoftでログイン
  ↓
OAuth Callback
  ↓
Laravel側でユーザー取得
  ↓
usersテーブルに作成または更新
  ↓
Sanctumセッション発行
  ↓
React側でログイン状態を保持
```

### ユーザー識別

* 基本はメールアドレスで同一ユーザー判定
* providerは google / microsoft を保存
* 同じメールアドレスなら同じユーザーとして扱う

---

## 6. 権限管理

### 権限

```text
owner
admin
member
```

### 判定基準

`group_members.role` を基準にする。

### Laravelでの実装

* Policyを使用する
* Controller内で必ず認可チェックを行う
* フロント側の表示制御だけに頼らない

例：

```php
$this->authorize('update', $group);
```

---

## 7. API実装方針

### 形式

* REST API
* レスポンスはJSON
* APIレスポンスのキーはcamelCase
* DBカラムはsnake_case

### 共通レスポンス

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

### エラー形式

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容に誤りがあります"
  }
}
```

---

## 8. バリデーション

Laravel Form Requestを使用する。

例：

```text
StoreGroupRequest
UpdateGroupRequest
StoreEventRequest
UpdateEventRequest
SaveAvailabilityRequest
SaveShiftRuleRequest
SaveGenerationSettingRequest
UpdateShiftAssignmentsRequest
```

フロントエンドではZodを使い、サーバー側でも必ずLaravelで再検証する。

---

## 9. フロントエンド仕様

### 採用技術

* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* TanStack Query
* React Hook Form
* Zod

### UI方針

* スマホファースト
* パステルカラー
* カード型UI
* ダッシュボードUI
* PCではサイドバー
* スマホでは下部ナビゲーション

### 状態管理

* サーバーデータ：TanStack Query
* フォーム：React Hook Form
* 認証ユーザー：Auth Context または Zustand

---

## 10. シフト自動生成仕様

### 実装場所

```text
app/Services/ShiftGeneration/
```

### 主要クラス

```text
ShiftGenerator
ShiftScoringService
```

### 入力

* イベント
* 時間枠
* メンバー
* 希望提出
* 基本ルール
* 最適化重み
* 固定割り当て

### 出力

* shift
* shift_assignments
* preference_score
* fairness_score
* required_people_score
* warnings

### 初期MVPの方針

最初は完全最適化ではなく、ルールベースで実装する。

優先順：

1. 必要人数を満たす
2. 参加可能な人だけを配置する
3. 最大勤務時間を超えない
4. 勤務時間が少ない人を優先する
5. 希望反映率を計算する
6. 公平性スコアを計算する

将来的に、より高度な最適化アルゴリズムに差し替えられる設計にする。

---

## 11. スコア計算

### 希望反映率

```text
希望に合った割り当て数 / 全割り当て数 * 100
```

### 必要人数達成率

```text
実際の割り当て人数 / 必要人数 * 100
```

### 公平性スコア

勤務時間のばらつきが小さいほど高くする。

例：

```text
100 - 勤務時間偏差に基づくペナルティ
```

---

## 12. Excel / CSV出力

### 使用ライブラリ

* Laravel Excel

### 出力形式

```text
xlsx
csv
```

### 出力パターン

```text
all
by_member
by_date
```

### 実装場所

```text
app/Exports/ShiftExport.php
```

### API

```text
GET /api/shifts/{shiftId}/export?format=xlsx&type=all
```

---

## 13. DB設計方針

* PostgreSQLを使用する
* 主キーはUUID
* 外部キー制約を設定する
* enum相当はPHP Enum + DB check制約で管理する
* created_at / updated_at を使用する
* 必要に応じて soft delete を導入する

---

## 14. セキュリティ方針

* 認証必須APIでは必ずログイン確認する
* 権限チェックは必ずサーバー側で行う
* CSRF対策を行う
* XSS対策として出力時にエスケープする
* SQLはEloquent / Query Builderを使用する
* DBエラーをそのままユーザーに返さない
* 招待コードは推測しにくいランダム文字列にする
* 公開前のシフトは管理者以上のみ閲覧可能にする

---

## 15. テスト方針

### Backend

* PHPUnit / Pest
* Feature Test
* Unit Test

### テスト対象

* ログイン
* グループ作成
* 権限チェック
* イベント作成
* 希望提出
* シフト生成
* シフト公開
* Excel出力

---

## 16. 開発環境

### 推奨

```text
WSL2
Docker
Laravel Sail
Node.js
PostgreSQL
```

### 初期セットアップ例

```bash
composer create-project laravel/laravel schedulecraft
cd schedulecraft

composer require laravel/sanctum
composer require laravel/socialite
composer require socialiteproviders/microsoft
composer require maatwebsite/excel

npm install
npm install react react-dom typescript @vitejs/plugin-react
npm install tailwindcss
npm install @tanstack/react-query react-hook-form zod
```

---

## 17. MVP実装順序

### Phase 1: 基盤

1. Laravelプロジェクト作成
2. React + TypeScript + Vite設定
3. Tailwind CSS設定
4. Sanctum設定
5. Google / Microsoft OAuth設定
6. usersテーブル整備

---

### Phase 2: グループ機能

1. groups
2. group_members
3. invitations
4. グループ作成
5. グループ参加
6. メンバー一覧

---

### Phase 3: イベント機能

1. events
2. event_slots
3. イベント作成
4. 時間枠作成
5. イベント詳細

---

### Phase 4: 希望提出

1. availability
2. 希望提出画面
3. 希望保存API
4. 提出率表示

---

### Phase 5: シフト生成

1. shift_rules
2. shift_generation_settings
3. shifts
4. shift_assignments
5. ルールベース自動生成
6. スコア計算
7. 生成結果表示

---

### Phase 6: 公開・出力

1. シフト公開
2. 自分のシフト表示
3. 全体シフト表示
4. Excel出力
5. CSV出力

---

## 18. Codexへの実装指示

この技術仕様書に従い、Laravel + React + TypeScript構成でScheduleCraftを実装する。

実装時のルール：

* Laravel API + React SPA構成にする
* APIはREST形式にする
* 認証はLaravel Sanctumを使用する
* OAuthはGoogle / Microsoftに対応する
* 権限管理はPolicyで実装する
* DBはPostgreSQLを想定する
* フロントエンドはReact + TypeScriptで実装する
* UIはTailwind CSSとshadcn/uiを使用する
* API通信はTanStack Queryを使用する
* フォームはReact Hook Form + Zodを使用する
* Excel出力はLaravel Excelを使用する
* シフト生成ロジックはService層に分離する
* Controllerにビジネスロジックを書きすぎない
* テストしやすい構成にする
* まずMVPを完成させ、その後拡張機能を追加する
