#!/usr/bin/env node

/**
 * Google Custom Search MCP Server Test Script
 * 
 * このスクリプトはMCPサーバが正常に動作するかをテストします。
 * 実際のAPIキーとSearch Engine IDが必要です。
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testMCPServer() {
  console.log('🚀 Google Custom Search MCPサーバのテストを開始します...\n');

  // MCPサーバのパス
  const serverPath = join(__dirname, '..', 'build', 'index.js');
  
  // MCPサーバを起動
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  // 初期化リクエスト
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };

  // ツール一覧取得リクエスト
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };

  // 検索テストリクエスト
  const searchRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'google_search',
      arguments: {
        query: 'TypeScript tutorial',
        num: 3
      }
    }
  };

  let responseCount = 0;
  let responses = [];

  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        responseCount++;
        
        console.log(`📥 レスポンス ${responseCount}:`, JSON.stringify(response, null, 2));
        
        if (responseCount === 3) {
          console.log('\n✅ すべてのテストが完了しました！');
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // JSON以外の出力は無視
      }
    }
  });

  server.on('error', (error) => {
    console.error('❌ サーバエラー:', error);
    process.exit(1);
  });

  server.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ サーバが異常終了しました (code: ${code})`);
      process.exit(1);
    }
  });

  // リクエストを順次送信
  setTimeout(() => {
    console.log('📤 初期化リクエストを送信...');
    server.stdin.write(JSON.stringify(initRequest) + '\n');
  }, 100);

  setTimeout(() => {
    console.log('📤 ツール一覧取得リクエストを送信...');
    server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  }, 200);

  setTimeout(() => {
    console.log('📤 検索テストリクエストを送信...');
    server.stdin.write(JSON.stringify(searchRequest) + '\n');
  }, 300);

  // タイムアウト処理
  setTimeout(() => {
    console.log('⏱️  テストがタイムアウトしました');
    server.kill();
    process.exit(1);
  }, 10000);
}

// 環境変数チェック
if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
  console.error('❌ 必要な環境変数が設定されていません:');
  console.error('   GOOGLE_API_KEY');
  console.error('   GOOGLE_SEARCH_ENGINE_ID');
  console.error('\n.envファイルを作成するか、環境変数を設定してください。');
  process.exit(1);
}

testMCPServer().catch(console.error);
