# MCP Redmine機能拡張依頼書

## 依頼日
2025年6月13日

## 依頼者
みなかみ出力制御ユニット開発チーム

## 背景・目的
現在のMCPツールセットではRedmineの課題情報を**参照**することは可能ですが、課題のステータス更新や進捗率の変更など、**更新系**の操作ができません。プロジェクト管理の効率化のため、以下の機能追加を依頼いたします。

## 要求機能

### 1. 課題更新機能（高優先度）
**機能名**: `redmine_update_issue`

**パラメータ**:
```json
{
  "issue_id": {
    "description": "更新する課題のID",
    "type": "number",
    "required": true
  },
  "status_id": {
    "description": "ステータスID（例：1=新規, 2=進行中, 3=解決済み, 5=完了）",
    "type": "number",
    "required": false
  },
  "assigned_to_id": {
    "description": "担当者のユーザーID",
    "type": "number",
    "required": false
  },
  "done_ratio": {
    "description": "進捗率（0-100）",
    "type": "number",
    "minimum": 0,
    "maximum": 100,
    "required": false
  },
  "notes": {
    "description": "更新時のコメント・注記",
    "type": "string",
    "required": false
  },
  "priority_id": {
    "description": "優先度ID",
    "type": "number",
    "required": false
  },
  "due_date": {
    "description": "期日（YYYY-MM-DD形式）",
    "type": "string",
    "required": false
  },
  "estimated_hours": {
    "description": "予定工数",
    "type": "number",
    "required": false
  },
  "custom_fields": {
    "description": "カスタムフィールドの配列",
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "id": {"type": "number"},
        "value": {"type": "string"}
      }
    },
    "required": false
  }
}
```

**使用例**:
```javascript
// 課題を完了状態に更新
redmine_update_issue({
  "issue_id": 44390,
  "status_id": 5,  // 完了
  "done_ratio": 100,
  "notes": "Bitbucketの利用申請が完了しました。"
})
```

### 2. 一括課題更新機能（中優先度）
**機能名**: `redmine_bulk_update_issues`

**パラメータ**:
```json
{
  "issue_ids": {
    "description": "更新する課題ID配列",
    "type": "array",
    "items": {"type": "number"},
    "required": true
  },
  "status_id": {
    "description": "一括設定するステータスID",
    "type": "number",
    "required": false
  },
  "assigned_to_id": {
    "description": "一括設定する担当者ID",
    "type": "number",
    "required": false
  },
  "notes": {
    "description": "一括更新時のコメント",
    "type": "string",
    "required": false
  }
}
```

### 3. ステータス・ユーザー情報取得機能（低優先度）
**機能名**: `redmine_get_statuses`、`redmine_get_users`

Redmineインスタンス固有のステータスIDやユーザーIDを取得するための機能。

## 技術仕様

### API エンドポイント
- **更新**: `PUT /issues/{id}.json`
- **一括更新**: `PUT /issues.json` (複数ID指定)

### 認証
現在の実装と同様のAPI Key認証を継続使用

### エラーハンドリング
- 権限不足の場合の適切なエラーメッセージ
- 不正なパラメータ値の検証
- ネットワークエラーの処理

## 利用シーン

### 現在困っている具体例
1. **課題完了時**: 手動でRedmineにアクセスしてステータス変更が必要
2. **進捗更新時**: AI助手が作業状況を把握していても、Redmineに反映できない
3. **担当者変更時**: プロジェクト状況変化に応じた担当者アサインができない

### 期待される効果
1. **作業効率向上**: ターミナル作業中にRedmine更新が完結
2. **情報同期**: 実際の作業進捗とRedmineの状態を即座に同期
3. **自動化促進**: CI/CDパイプラインとの連携による自動ステータス更新

## 実装優先度
1. **高**: `redmine_update_issue` - 基本的な課題更新機能
2. **中**: `redmine_bulk_update_issues` - 複数課題の一括更新
3. **低**: ステータス・ユーザー情報取得機能

## 検証方法
以下の操作が正常に動作することを確認：
```bash
# 単一課題の完了
redmine_update_issue(44390, status_id=5, done_ratio=100)

# 複数課題の一括ステータス変更
redmine_bulk_update_issues([44390, 44391], status_id=3, notes="対応完了")
```

## 補足
現在のプロジェクト「みなかみ出力制御ユニット開発」では55件の課題を管理しており、この機能により大幅な作業効率向上が期待されます。

---
**連絡先**: みなかみプロジェクトチーム  
**緊急度**: 中（次回リリースでの対応を希望）
