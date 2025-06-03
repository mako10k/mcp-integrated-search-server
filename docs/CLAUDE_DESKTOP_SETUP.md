# Claude Desktop 設定ガイド

このファイルでは、統合検索MCPサーバ（Google Custom Search + Redmine API）をClaude Desktopで使用するための設定方法を説明します。

## 設定ファイルの場所

### macOS
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### Windows
```
%APPDATA%/Claude/claude_desktop_config.json
```

### Linux
```
~/.config/claude-desktop/claude_desktop_config.json
```

注意: Claude Desktopの設定ファイルの場所は、実際のインストール方法やバージョンによって異なる場合があります。上記のパスが見つからない場合は、以下のようなパスも確認してください：
- `~/.config/Claude/claude_desktop_config.json`
- `~/.config/anthropic/claude_desktop_config.json`

## 設定例

以下の内容をClaude Desktopの設定ファイルに追加してください：

```json
{
  "mcpServers": {
    "integrated-search-server": {
      "command": "node",
      "args": ["/home/solar/mcp-redmine/build/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your_google_api_key_here",
        "GOOGLE_SEARCH_ENGINE_ID": "your_search_engine_id_here",
        "REDMINE_URL": "https://your-redmine-instance.com",
        "REDMINE_API_KEY": "your_redmine_api_key_here",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**注意**: 
- パスは実際のプロジェクトの場所に合わせて変更してください
- APIキーとRedmine設定を実際の値に置き換えてください
- Redmine設定は任意です（設定しない場合はGoogle検索のみ利用可能）

## 環境変数の設定

環境変数は2つの方法で設定できます：

### 1. 設定ファイル内で直接指定（推奨）

上記の例のように、`env`オブジェクト内で環境変数を直接指定します。

### 2. システムの環境変数を使用

```json
{
  "mcpServers": {
    "integrated-search-server": {
      "command": "node",
      "args": ["/home/solar/mcp-redmine/build/index.js"]
    }
  }
}
```

この場合、システムに以下の環境変数を設定する必要があります：
- `GOOGLE_API_KEY`
- `GOOGLE_SEARCH_ENGINE_ID`
- `LOG_LEVEL` (オプション)

## トラブルシューティング

### 1. モジュールが見つからないエラー

```
Error: Cannot find module '/path/to/build/index.js'
```

**解決方法**: パスが正しいか確認してください。絶対パスを使用することを推奨します。

### 2. APIキーエラー

```
Google Custom Search API quota exceeded or invalid API key
```

**解決方法**: 
- Google API Keyが正しく設定されているか確認
- Custom Search Engine IDが正しく設定されているか確認
- APIの使用制限に達していないか確認

### 3. サーバが起動しないエラー

**確認事項**:
- Node.jsがインストールされているか
- プロジェクトがビルドされているか (`npm run build`)
- 必要な依存関係がインストールされているか (`npm install`)

## デバッグ方法

### ログレベルの変更

環境変数`LOG_LEVEL`を`debug`に設定すると、詳細なログが表示されます：

```json
"env": {
  "GOOGLE_API_KEY": "your_api_key",
  "GOOGLE_SEARCH_ENGINE_ID": "your_search_engine_id",
  "LOG_LEVEL": "debug"
}
```

### 手動でのサーバテスト

ターミナルで以下のコマンドを実行してサーバが正常に動作するかテストできます：

```bash
cd /home/solar/mcp-redmine
export GOOGLE_API_KEY="your_api_key"
export GOOGLE_SEARCH_ENGINE_ID="your_search_engine_id"
npm start
```

## 使用開始

設定完了後、Claude Desktopを再起動してください。正常に設定されていれば、Claudeでの会話中に以下のようなツールが利用可能になります：

- `google_search`: ウェブ検索
- `google_search_images`: 画像検索

### 使用例

```
「TypeScript 最新情報」について検索してください
```

```
猫の可愛い画像を検索してください
```
