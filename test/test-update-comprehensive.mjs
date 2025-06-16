#!/usr/bin/env node

/**
 * Comprehensive test script for Redmine update functionality
 * Tests various update scenarios and parameter combinations
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Comprehensive Redmine Update Testing...\n');

// Load environment variables from .env file
const dotenvPath = join(__dirname, '..', '.env');
try {
  const fs = await import('fs');
  const envContent = fs.readFileSync(dotenvPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim();
    }
  });
  
  Object.assign(process.env, envVars);
} catch (error) {
  console.log('⚠️ Could not load .env file');
  process.exit(1);
}

// Check Redmine environment variables
if (!process.env.REDMINE_URL || !process.env.REDMINE_API_KEY) {
  console.log('❌ Redmine configuration not found in .env file');
  process.exit(1);
}

console.log(`✅ Redmine URL: ${process.env.REDMINE_URL}`);
console.log(`✅ Redmine API Key: ${process.env.REDMINE_API_KEY.substring(0, 8)}...`);

// Test scenarios
const testScenarios = [
  {
    name: "進捗率とコメント更新",
    description: "課題の進捗率を50%に更新し、作業コメントを追加",
    params: {
      issue_id: 9178,
      done_ratio: 50,
      notes: `包括テスト: 進捗50% - ${new Date().toLocaleString()}`
    }
  },
  {
    name: "ステータス変更",
    description: "課題のステータスを進行中（ID: 2）に変更",
    params: {
      issue_id: 9178,
      status_id: 2,
      notes: `包括テスト: ステータス変更 - ${new Date().toLocaleString()}`
    }
  },
  {
    name: "期日設定",
    description: "課題の期日を来月末に設定",
    params: {
      issue_id: 9178,
      due_date: "2025-07-31",
      notes: `包括テスト: 期日設定 - ${new Date().toLocaleString()}`
    }
  },
  {
    name: "予定工数設定",
    description: "課題の予定工数を8時間に設定",
    params: {
      issue_id: 9178,
      estimated_hours: 8.0,
      notes: `包括テスト: 予定工数設定 - ${new Date().toLocaleString()}`
    }
  },
  {
    name: "複合更新",
    description: "進捗率、ステータス、コメントを同時更新",
    params: {
      issue_id: 9178,
      status_id: 3, // 解決済み
      done_ratio: 100,
      notes: `包括テスト: 複合更新 - 作業完了 - ${new Date().toLocaleString()}`
    }
  }
];

// Bulk update test scenarios
const bulkTestScenarios = [
  {
    name: "一括ステータス変更",
    description: "複数課題のステータスを一括で新規（ID: 1）に変更",
    params: {
      issue_ids: [9178, 9180],
      status_id: 1,
      notes: `包括テスト: 一括ステータス変更 - ${new Date().toLocaleString()}`
    }
  },
  {
    name: "一括コメント追加",
    description: "複数課題に一括でコメントを追加",
    params: {
      issue_ids: [9178, 9180],
      notes: `包括テスト: 一括コメント追加 - ${new Date().toLocaleString()}`
    }
  }
];

let currentTestIndex = 0;
let totalTests = testScenarios.length + bulkTestScenarios.length;
let passedTests = 0;
let failedTests = 0;

function runNextTest() {
  if (currentTestIndex < testScenarios.length) {
    // Run single update tests
    const scenario = testScenarios[currentTestIndex];
    console.log(`\n📋 テスト ${currentTestIndex + 1}/${totalTests}: ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    runSingleUpdateTest(scenario);
  } else if (currentTestIndex < totalTests) {
    // Run bulk update tests
    const bulkIndex = currentTestIndex - testScenarios.length;
    const scenario = bulkTestScenarios[bulkIndex];
    console.log(`\n📦 テスト ${currentTestIndex + 1}/${totalTests}: ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    runBulkUpdateTest(scenario);
  } else {
    // All tests completed
    showFinalResults();
  }
}

function runSingleUpdateTest(scenario) {
  const serverPath = join(__dirname, '..', 'build', 'index.js');
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env
  });

  const initMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'comprehensive-test-client',
        version: '1.0.0'
      }
    }
  };

  const updateMessage = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'redmine_update_issue',
      arguments: scenario.params
    }
  };

  let responseCount = 0;

  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        responseCount++;
        
        if (response.id === 1) {
          // Server initialized
        } else if (response.id === 2) {
          if (response.error) {
            console.log(`   ❌ 失敗: ${response.error.message}`);
            failedTests++;
          } else {
            console.log(`   ✅ 成功`);
            if (response.result?.content?.[0]?.text) {
              const resultLines = response.result.content[0].text.split('\n');
              console.log(`   📄 結果: ${resultLines[0]}`);
              if (resultLines[2]) {
                console.log(`   📝 詳細: ${resultLines[2]}`);
              }
            }
            passedTests++;
          }
          
          server.kill();
          currentTestIndex++;
          setTimeout(runNextTest, 1000); // Wait 1 second between tests
        }
      } catch (e) {
        // Ignore non-JSON lines
      }
    });
  });

  server.stderr.on('data', (data) => {
    // Ignore server logs for cleaner output
  });

  server.on('error', (error) => {
    console.log(`   ❌ サーバーエラー: ${error.message}`);
    failedTests++;
    currentTestIndex++;
    setTimeout(runNextTest, 1000);
  });

  // Send test messages
  setTimeout(() => {
    server.stdin.write(JSON.stringify(initMessage) + '\n');
  }, 100);

  setTimeout(() => {
    server.stdin.write(JSON.stringify(updateMessage) + '\n');
  }, 500);

  // Timeout after 10 seconds
  setTimeout(() => {
    console.log(`   ⏰ タイムアウト`);
    server.kill();
    failedTests++;
    currentTestIndex++;
    setTimeout(runNextTest, 1000);
  }, 10000);
}

function runBulkUpdateTest(scenario) {
  const serverPath = join(__dirname, '..', 'build', 'index.js');
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env
  });

  const initMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'comprehensive-bulk-test-client',
        version: '1.0.0'
      }
    }
  };

  const bulkUpdateMessage = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'redmine_bulk_update_issues',
      arguments: scenario.params
    }
  };

  let responseCount = 0;

  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        responseCount++;
        
        if (response.id === 1) {
          // Server initialized
        } else if (response.id === 2) {
          if (response.error) {
            console.log(`   ❌ 失敗: ${response.error.message}`);
            failedTests++;
          } else {
            console.log(`   ✅ 成功`);
            if (response.result?.content?.[0]?.text) {
              const resultLines = response.result.content[0].text.split('\n');
              console.log(`   📄 結果: ${resultLines[0]}`);
              // Show successful updates count
              const successLine = resultLines.find(line => line.includes('Successfully Updated'));
              if (successLine) {
                console.log(`   📝 ${successLine.trim()}`);
              }
            }
            passedTests++;
          }
          
          server.kill();
          currentTestIndex++;
          setTimeout(runNextTest, 1000);
        }
      } catch (e) {
        // Ignore non-JSON lines
      }
    });
  });

  server.stderr.on('data', (data) => {
    // Ignore server logs for cleaner output
  });

  server.on('error', (error) => {
    console.log(`   ❌ サーバーエラー: ${error.message}`);
    failedTests++;
    currentTestIndex++;
    setTimeout(runNextTest, 1000);
  });

  // Send test messages
  setTimeout(() => {
    server.stdin.write(JSON.stringify(initMessage) + '\n');
  }, 100);

  setTimeout(() => {
    server.stdin.write(JSON.stringify(bulkUpdateMessage) + '\n');
  }, 500);

  // Timeout after 10 seconds
  setTimeout(() => {
    console.log(`   ⏰ タイムアウト`);
    server.kill();
    failedTests++;
    currentTestIndex++;
    setTimeout(runNextTest, 1000);
  }, 10000);
}

function showFinalResults() {
  console.log('\n' + '='.repeat(60));
  console.log('🏁 包括テスト結果');
  console.log('='.repeat(60));
  console.log(`✅ 成功: ${passedTests}/${totalTests}`);
  console.log(`❌ 失敗: ${failedTests}/${totalTests}`);
  console.log(`📊 成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 すべてのテストが成功しました！');
    console.log('   Redmine課題更新機能は完全に動作しています。');
  } else {
    console.log(`\n⚠️  ${failedTests}件のテストが失敗しました。`);
    console.log('   詳細なログを確認してください。');
  }
  
  console.log('\n📋 テストしたシナリオ:');
  testScenarios.forEach((scenario, index) => {
    console.log(`   ${index + 1}. ${scenario.name}`);
  });
  bulkTestScenarios.forEach((scenario, index) => {
    console.log(`   ${testScenarios.length + index + 1}. ${scenario.name}`);
  });
  
  process.exit(failedTests === 0 ? 0 : 1);
}

// Start testing
console.log(`🚀 ${totalTests}個のテストシナリオを開始します...\n`);
runNextTest();
