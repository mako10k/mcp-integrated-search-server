# 統合検索MCP Server - 使用例

このドキュメントでは、統合検索MCPサーバ（Google Custom Search + Redmine API）の具体的な使用例を示します。

## セットアップ

### 1. 環境変数の設定

`.env`ファイルを作成し、以下の内容を設定してください：

```env
GOOGLE_API_KEY=AIzaSyD...（あなたのGoogle API Key）
GOOGLE_SEARCH_ENGINE_ID=017576...（あなたのCustom Search Engine ID）
REDMINE_URL=https://your-redmine-instance.com（任意）
REDMINE_API_KEY=your_redmine_api_key（任意）
LOG_LEVEL=info
```

### 2. Claude Desktopでの設定

Claude Desktopの設定ファイルに以下を追加してください：

```json
{
  "mcpServers": {
    "integrated-search-server": {
      "command": "node",
      "args": ["/home/solar/mcp-redmine/build/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your_api_key_here",
        "GOOGLE_SEARCH_ENGINE_ID": "your_search_engine_id_here",
        "REDMINE_URL": "https://your-redmine-instance.com",
        "REDMINE_API_KEY": "your_redmine_api_key_here"
      }
    }
  }
}
```

## 使用例

### 基本的なWeb検索

```
「TypeScript 入門」について検索してください
```

### 特定サイト内での検索

```
GitHub上でReactに関するプロジェクトを検索してください
（パラメータ: siteSearch = "github.com"）
```

### ファイルタイプを指定した検索

```
機械学習に関するPDFドキュメントを検索してください
（パラメータ: fileType = "pdf"）
```

### 言語を指定した検索

```
日本語のページでVue.jsの情報を検索してください
（パラメータ: lr = "lang_ja"）
```

### 画像検索

```
美しい日本の風景の画像を検索してください
```

### 特定サイズの画像検索

```
大きなサイズの猫の写真を検索してください
（パラメータ: imgSize = "large"）
```

### 特定タイプの画像検索

```
ビジネス用のクリップアート画像を検索してください
（パラメータ: imgType = "clipart"）
```

## Redmine API の使用例

### 課題の一覧取得

```
Redmineのプロジェクト136の課題を表示してください
（パラメータ: project_id = 136）
```

```
プロジェクト120のオープンな課題を10件表示してください
（パラメータ: project_id = 120, status_id = "open", limit = 10）
```

```
自分に割り当てられた課題を確認してください
（パラメータ: assigned_to_id = YOUR_USER_ID）
```

### 課題の作成 ✅ 動作確認済み

```
SPV保守Tipsプロジェクトに新しいTipsを作成してください
件名: "新しい保守手順"
説明: "効率的な保守手順についてのTips"
（パラメータ: project_id = 136, tracker_id = 24, subject = "新しい保守手順", description = "..."）
```

```
助成金レポートプロジェクトに機能改善の提案を作成してください
（パラメータ: project_id = 120, tracker_id = 2, subject = "機能改善提案"）
```

### プロジェクトの一覧取得

```
利用可能なRedmineプロジェクト一覧を表示してください
```

### 課題の詳細取得

```
課題#123の詳細情報を取得してください
（パラメータ: issue_id = 123）
```

```
課題#456の詳細と添付ファイル、コメント履歴を表示してください
（パラメータ: issue_id = 456, include = "attachments,journals"）
```

## よくある質問

### Google Custom Search について

### Q: API制限はありますか？
A: Google Custom Search APIは1日100クエリまで無料です。それ以上の場合は課金が必要です。

### Q: 検索結果が表示されません
A: 以下を確認してください：
- API KeyとSearch Engine IDが正しく設定されているか
- APIが有効になっているか
- 1日のクエリ制限に達していないか

### Redmine API について

### Q: Redmine APIキーの取得方法は？
A: Redmineにログイン後、「個人設定」→「APIアクセスキー」で確認・生成できます。

### Q: Redmine設定なしでも使用できますか？
A: はい。Redmine設定がない場合でも、Google検索機能は正常に動作します。

### Q: Redmineの権限エラーが発生します
A: 以下を確認してください：
- APIキーが正しく設定されているか
- 対象プロジェクトへのアクセス権限があるか
- Redmine側でAPIアクセスが有効になっているか

### Q: エラーメッセージの意味は？
A: 主なエラーメッセージ：
- "Invalid API key": API Keyが間違っています
- "Quota exceeded": 1日の制限に達しました（Google）
- "Redmine authentication failed": Redmine APIキーが無効です
- "Redmine access forbidden": アクセス権限がありません

## トラブルシューティング

### デバッグモードの有効化

`.env`ファイルで以下を設定してください：

```env
LOG_LEVEL=debug
```

これにより、詳細なログが出力されます。

### ネットワーク接続の確認

```bash
curl "https://www.googleapis.com/customsearch/v1?key=YOUR_API_KEY&cx=YOUR_SEARCH_ENGINE_ID&q=test"
```

このコマンドでAPIが正常に動作するか確認できます。
