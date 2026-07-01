# ScheduleCraft API設計書（Version 0.1）

## 1. 前提

本API設計は、ScheduleCraftのフロントエンドとバックエンドを接続するための仕様である。

想定技術構成：

* Frontend: Next.js / TypeScript
* Backend: Supabase / PostgreSQL
* Auth: Supabase Auth
* Login Provider: Google / Microsoft
* Export: Excel / CSV
* API形式: Next.js Route Handlers または Server Actions

---

## 2. 共通仕様

### 認証

すべてのAPIは、原則としてログイン済みユーザーのみ利用可能とする。

例外：

* ログイン
* OAuth callback
* 招待コード確認

---

### レスポンス形式

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

エラー時：

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ"
  }
}
```

---

## 3. 認証API

### GET /api/auth/me

現在ログイン中のユーザー情報を取得する。

#### 権限

ログイン済みユーザー

#### Response

```json
{
  "id": "uuid",
  "displayName": "山田太郎",
  "email": "user@example.com",
  "avatarUrl": "https://example.com/avatar.png",
  "provider": "google"
}
```

---

### POST /api/auth/profile

初回ログイン後のプロフィールを作成・更新する。

#### 権限

ログイン済みユーザー

#### Request

```json
{
  "displayName": "山田太郎",
  "avatarUrl": "https://example.com/avatar.png"
}
```

#### Response

```json
{
  "id": "uuid",
  "displayName": "山田太郎"
}
```

---

## 4. グループAPI

### GET /api/groups

自分が所属しているグループ一覧を取得する。

#### 権限

ログイン済みユーザー

#### Response

```json
[
  {
    "id": "uuid",
    "name": "文化祭実行委員",
    "description": "2026年度文化祭",
    "iconUrl": null,
    "memberCount": 32,
    "myRole": "owner"
  }
]
```

---

### POST /api/groups

新しいグループを作成する。

#### 権限

ログイン済みユーザー

#### Request

```json
{
  "name": "文化祭実行委員",
  "description": "2026年度文化祭",
  "iconUrl": null
}
```

#### Response

```json
{
  "id": "uuid",
  "name": "文化祭実行委員",
  "role": "owner"
}
```

---

### GET /api/groups/:groupId

グループ詳細を取得する。

#### 権限

グループメンバー

#### Response

```json
{
  "id": "uuid",
  "name": "文化祭実行委員",
  "description": "2026年度文化祭",
  "iconUrl": null,
  "memberCount": 32,
  "myRole": "admin",
  "inviteEnabled": true
}
```

---

### PATCH /api/groups/:groupId

グループ情報を更新する。

#### 権限

owner / admin

#### Request

```json
{
  "name": "文化祭実行委員",
  "description": "説明文",
  "iconUrl": null,
  "isInviteEnabled": true
}
```

---

### DELETE /api/groups/:groupId

グループを削除する。

#### 権限

owner

---

## 5. メンバーAPI

### GET /api/groups/:groupId/members

グループメンバー一覧を取得する。

#### 権限

グループメンバー

#### Response

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "displayName": "山田太郎",
    "email": "user@example.com",
    "avatarUrl": null,
    "role": "member",
    "joinedAt": "2026-07-01T10:00:00Z"
  }
]
```

---

### PATCH /api/groups/:groupId/members/:memberId

メンバー権限を変更する。

#### 権限

owner / admin

#### Request

```json
{
  "role": "admin"
}
```

---

### DELETE /api/groups/:groupId/members/:memberId

メンバーを削除する。

#### 権限

owner / admin

---

## 6. 招待API

### POST /api/groups/:groupId/invitations

招待コード・招待URLを作成する。

#### 権限

owner / admin

#### Request

```json
{
  "expiresAt": "2026-08-01T23:59:59Z"
}
```

#### Response

```json
{
  "inviteCode": "A7XK9P",
  "inviteUrl": "https://app.example.com/join/A7XK9P",
  "expiresAt": "2026-08-01T23:59:59Z"
}
```

---

### GET /api/invitations/:inviteCode

招待コードの情報を取得する。

#### 権限

ログイン済みユーザー

#### Response

```json
{
  "groupId": "uuid",
  "groupName": "文化祭実行委員",
  "isActive": true,
  "expiresAt": "2026-08-01T23:59:59Z"
}
```

---

### POST /api/invitations/:inviteCode/join

招待コードからグループに参加する。

#### 権限

ログイン済みユーザー

#### Response

```json
{
  "groupId": "uuid",
  "role": "member"
}
```

---

## 7. イベントAPI

### GET /api/groups/:groupId/events

グループ内のイベント一覧を取得する。

#### 権限

グループメンバー

#### Response

```json
[
  {
    "id": "uuid",
    "name": "文化祭準備",
    "location": "教室棟",
    "startDate": "2026-07-20",
    "endDate": "2026-08-20",
    "availabilityDeadline": "2026-07-15T23:59:59Z",
    "status": "collecting",
    "submissionRate": 72,
    "shiftStatus": "not_generated"
  }
]
```

---

### POST /api/groups/:groupId/events

イベントを作成する。

#### 権限

owner / admin

#### Request

```json
{
  "name": "文化祭準備",
  "description": "夏休み中の準備シフト",
  "location": "教室棟",
  "startDate": "2026-07-20",
  "endDate": "2026-08-20",
  "availabilityDeadline": "2026-07-15T23:59:59Z"
}
```

---

### GET /api/events/:eventId

イベント詳細を取得する。

#### 権限

イベントが属するグループのメンバー

#### Response

```json
{
  "id": "uuid",
  "groupId": "uuid",
  "name": "文化祭準備",
  "description": "夏休み中の準備シフト",
  "location": "教室棟",
  "startDate": "2026-07-20",
  "endDate": "2026-08-20",
  "availabilityDeadline": "2026-07-15T23:59:59Z",
  "status": "collecting",
  "submissionRate": 72,
  "myRole": "admin"
}
```

---

### PATCH /api/events/:eventId

イベント情報を更新する。

#### 権限

owner / admin

---

### DELETE /api/events/:eventId

イベントを削除する。

#### 権限

owner / admin

---

## 8. イベント時間枠API

### GET /api/events/:eventId/slots

イベントの時間枠一覧を取得する。

#### 権限

グループメンバー

#### Response

```json
[
  {
    "id": "uuid",
    "date": "2026-07-20",
    "startTime": "09:00",
    "endTime": "12:00",
    "requiredPeople": 3,
    "location": "1年A組",
    "note": "装飾作業"
  }
]
```

---

### POST /api/events/:eventId/slots

時間枠を作成する。

#### 権限

owner / admin

#### Request

```json
{
  "date": "2026-07-20",
  "startTime": "09:00",
  "endTime": "12:00",
  "requiredPeople": 3,
  "location": "1年A組",
  "note": "装飾作業"
}
```

---

### PATCH /api/events/:eventId/slots/:slotId

時間枠を更新する。

#### 権限

owner / admin

---

### DELETE /api/events/:eventId/slots/:slotId

時間枠を削除する。

#### 権限

owner / admin

---

## 9. 希望提出API

### GET /api/events/:eventId/availability/me

自分の希望提出内容を取得する。

#### 権限

グループメンバー

#### Response

```json
[
  {
    "id": "uuid",
    "date": "2026-07-20",
    "startTime": "09:00",
    "endTime": "12:00",
    "status": "available",
    "comment": "午前なら参加できます"
  }
]
```

---

### PUT /api/events/:eventId/availability/me

自分の希望提出内容を保存する。

既存の提出内容を置き換える。

#### 権限

グループメンバー

#### Request

```json
{
  "items": [
    {
      "date": "2026-07-20",
      "startTime": "09:00",
      "endTime": "12:00",
      "status": "available",
      "comment": "午前なら参加できます"
    }
  ]
}
```

---

### GET /api/events/:eventId/availability

全メンバーの希望提出状況を取得する。

#### 権限

owner / admin

#### Response

```json
{
  "submissionRate": 72,
  "members": [
    {
      "userId": "uuid",
      "displayName": "山田太郎",
      "submitted": true,
      "availabilityCount": 5
    }
  ]
}
```

---

## 10. シフト条件API

### GET /api/events/:eventId/shift-rules

シフト基本条件を取得する。

#### 権限

owner / admin

---

### PUT /api/events/:eventId/shift-rules

シフト基本条件を保存する。

#### 権限

owner / admin

#### Request

```json
{
  "slotMinutes": 60,
  "minWorkMinutes": 120,
  "maxWorkMinutes": 360,
  "maxContinuousMinutes": 180,
  "breakMinutes": 30,
  "leaderRequiredPerSlot": 1
}
```

---

### GET /api/events/:eventId/generation-settings

自動生成の重み設定を取得する。

#### 権限

owner / admin

---

### PUT /api/events/:eventId/generation-settings

自動生成の重み設定を保存する。

#### 権限

owner / admin

#### Request

```json
{
  "preferenceWeight": 80,
  "fairnessWeight": 70,
  "balanceWorkloadWeight": 90,
  "avoidContinuousWorkWeight": 60,
  "leaderAssignmentWeight": 80,
  "requiredPeopleWeight": 100
}
```

---

## 11. シフト生成API

### POST /api/events/:eventId/shifts/generate

条件に基づいてシフトを自動生成する。

#### 権限

owner / admin

#### Request

```json
{
  "saveAsDraft": true
}
```

#### Response

```json
{
  "shiftId": "uuid",
  "version": 1,
  "scores": {
    "preferenceScore": 93,
    "fairnessScore": 96,
    "requiredPeopleScore": 100,
    "averageWorkMinutes": 210,
    "maxWorkMinutes": 300,
    "minWorkMinutes": 120
  },
  "warnings": [
    {
      "type": "shortage",
      "date": "2026-07-20",
      "startTime": "13:00",
      "endTime": "16:00",
      "message": "あと2人必要です"
    }
  ]
}
```

---

### POST /api/events/:eventId/shifts/:shiftId/regenerate

既存条件をもとに再生成する。

#### 権限

owner / admin

---

## 12. シフトAPI

### GET /api/events/:eventId/shifts

イベントのシフト一覧を取得する。

#### 権限

グループメンバー

#### Response

```json
[
  {
    "id": "uuid",
    "version": 1,
    "status": "draft",
    "createdAt": "2026-07-01T10:00:00Z",
    "preferenceScore": 93,
    "fairnessScore": 96
  }
]
```

---

### GET /api/shifts/:shiftId

シフト詳細を取得する。

#### 権限

* draft: owner / admin
* published: グループメンバー

#### Response

```json
{
  "id": "uuid",
  "eventId": "uuid",
  "version": 1,
  "status": "draft",
  "scores": {
    "preferenceScore": 93,
    "fairnessScore": 96,
    "requiredPeopleScore": 100,
    "averageWorkMinutes": 210
  },
  "assignments": [
    {
      "slotId": "uuid",
      "date": "2026-07-20",
      "startTime": "09:00",
      "endTime": "12:00",
      "requiredPeople": 3,
      "users": [
        {
          "userId": "uuid",
          "displayName": "山田太郎",
          "isFixed": false,
          "assignedBy": "auto"
        }
      ]
    }
  ]
}
```

---

### PATCH /api/shifts/:shiftId/assignments

シフト割り当てを手動更新する。

#### 権限

owner / admin

#### Request

```json
{
  "assignments": [
    {
      "slotId": "uuid",
      "userIds": ["uuid", "uuid"]
    }
  ]
}
```

#### Response

```json
{
  "shiftId": "uuid",
  "scores": {
    "preferenceScore": 90,
    "fairnessScore": 94,
    "requiredPeopleScore": 100
  },
  "warnings": []
}
```

---

### POST /api/shifts/:shiftId/publish

シフトを公開する。

#### 権限

owner / admin

#### Response

```json
{
  "shiftId": "uuid",
  "status": "published"
}
```

---

### DELETE /api/shifts/:shiftId

シフトを削除する。

#### 権限

owner / admin

---

## 13. 自分のシフトAPI

### GET /api/events/:eventId/shifts/me

自分のシフトを取得する。

#### 権限

グループメンバー

#### Response

```json
[
  {
    "date": "2026-07-20",
    "startTime": "09:00",
    "endTime": "12:00",
    "location": "1年A組",
    "note": "装飾作業"
  }
]
```

---

## 14. エクスポートAPI

### GET /api/shifts/:shiftId/export?format=xlsx&type=all

シフトをファイル出力する。

#### 権限

owner / admin

#### Query

```text
format = xlsx | csv
type = all | by_member | by_date
```

#### Response

```text
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

または

```text
text/csv
```

---

## 15. 通知API

### GET /api/notifications

自分宛ての通知一覧を取得する。

#### 権限

ログイン済みユーザー

---

### PATCH /api/notifications/:notificationId/read

通知を既読にする。

#### 権限

通知対象ユーザー

---

## 16. エラーコード

```text
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
GROUP_NOT_FOUND
EVENT_NOT_FOUND
INVITATION_EXPIRED
INVITATION_DISABLED
SHIFT_GENERATION_FAILED
EXPORT_FAILED
```

---

## 17. MVPで実装するAPI

### 必須

```text
GET    /api/auth/me
POST   /api/auth/profile

GET    /api/groups
POST   /api/groups
GET    /api/groups/:groupId
PATCH  /api/groups/:groupId

GET    /api/groups/:groupId/members

POST   /api/groups/:groupId/invitations
GET    /api/invitations/:inviteCode
POST   /api/invitations/:inviteCode/join

GET    /api/groups/:groupId/events
POST   /api/groups/:groupId/events
GET    /api/events/:eventId
PATCH  /api/events/:eventId

GET    /api/events/:eventId/slots
POST   /api/events/:eventId/slots

GET    /api/events/:eventId/availability/me
PUT    /api/events/:eventId/availability/me

GET    /api/events/:eventId/shift-rules
PUT    /api/events/:eventId/shift-rules

GET    /api/events/:eventId/generation-settings
PUT    /api/events/:eventId/generation-settings

POST   /api/events/:eventId/shifts/generate
GET    /api/events/:eventId/shifts
GET    /api/shifts/:shiftId
PATCH  /api/shifts/:shiftId/assignments
POST   /api/shifts/:shiftId/publish

GET    /api/events/:eventId/shifts/me
GET    /api/shifts/:shiftId/export
```

### 後回し

```text
DELETE /api/groups/:groupId
DELETE /api/events/:eventId
DELETE /api/shifts/:shiftId

GET    /api/notifications
PATCH  /api/notifications/:notificationId/read

POST   /api/events/:eventId/shifts/:shiftId/regenerate
```

---

## 18. 実装時の注意

* APIは必ず認証済みユーザーを取得してから処理する。
* 権限チェックは必ずサーバー側で行う。
* `group_members.role` をもとに owner / admin / member を判定する。
* draft のシフトは owner / admin のみ閲覧可能。
* published のシフトはグループメンバー全員が閲覧可能。
* availability は本人のみ編集可能。
* 管理者は全員分の availability を閲覧できる。
* 入力値は Zod などでバリデーションする。
* DBエラーをそのままフロントに返さない。
* 日付と時刻は保存形式を統一する。
* UI表示は日本時間を基本とする。
* APIレスポンスのキーは camelCase に統一する。
* DBカラムは snake_case に統一する。
