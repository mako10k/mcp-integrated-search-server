#!/usr/bin/env node

/**
 * Test script for improved Redmine update functionality with detailed analysis
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Improved Redmine Update Functionality...\n');

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
  
  // Set environment variables
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

// Start the MCP server
const serverPath = join(__dirname, '..', 'build', 'index.js');
console.log(`🚀 Starting MCP server: ${serverPath}`);

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

// Test messages
const initMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'improved-update-test-client',
      version: '1.0.0'
    }
  }
};

// Test 1: 進捗率の更新（成功が期待される）
const testProgressUpdate = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'redmine_update_issue',
    arguments: {
      issue_id: 9191, // プロジェクト137の課題（進捗率更新が可能）
      done_ratio: 50,
      notes: '改善された更新機能テスト - 進捗率50%'
    }
  }
};

// Test 2: ステータス変更（失敗が期待される）
const testStatusUpdate = {
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: {
    name: 'redmine_update_issue',
    arguments: {
      issue_id: 9191,
      status_id: 2, // 進行中
      notes: '改善された更新機能テスト - ステータス変更'
    }
  }
};

// Test 3: 複合更新（部分成功が期待される）
const testComplexUpdate = {
  jsonrpc: '2.0',
  id: 4,
  method: 'tools/call',
  params: {
    name: 'redmine_update_issue',
    arguments: {
      issue_id: 9191,
      status_id: 2, // 進行中（失敗予想）
      done_ratio: 75, // 進捗率（成功予想）
      due_date: '2025-07-31', // 期日（成功/失敗不明）
      estimated_hours: 8, // 予定工数（成功/失敗不明）
      notes: '改善された更新機能テスト - 複合更新'
    }
  }
};

let responseCount = 0;
let testIndex = 0;
const tests = [
  { message: testProgressUpdate, name: 'Progress Update Test' },
  { message: testStatusUpdate, name: 'Status Update Test' },
  { message: testComplexUpdate, name: 'Complex Update Test' }
];

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      responseCount++;
      
      if (response.id === 1) {
        console.log('✅ Server initialized successfully');
        console.log(`   Protocol version: ${response.result?.protocolVersion || 'unknown'}`);
        console.log('\n🧪 Starting improved update tests...\n');
        
        // Start first test
        runNextTest();
      } else if (response.id >= 2 && response.id <= 4) {
        const testName = tests[response.id - 2]?.name || `Test ${response.id}`;
        
        if (response.error) {
          console.log(`❌ ${testName} failed:`);
          console.log(`   Error: ${response.error.message}`);
        } else {
          console.log(`✅ ${testName} completed:`);
          if (response.result?.content?.[0]?.text) {
            console.log('   Results:');
            response.result.content[0].text.split('\n').forEach(line => {
              console.log(`     ${line}`);
            });
          }
        }
        
        console.log(''); // Add blank line
        
        // Run next test or finish
        runNextTest();
      }
    } catch (e) {
      // Ignore non-JSON lines (like log messages)
    }
  });
});

function runNextTest() {
  if (testIndex < tests.length) {
    const test = tests[testIndex];
    console.log(`🔄 Running: ${test.name}`);
    server.stdin.write(JSON.stringify(test.message) + '\n');
    testIndex++;
  } else {
    console.log('🎉 All improved update tests completed!');
    server.kill();
    process.exit(0);
  }
}

server.stderr.on('data', (data) => {
  console.log('Server stderr:', data.toString());
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

// Send init message
setTimeout(() => {
  server.stdin.write(JSON.stringify(initMessage) + '\n');
}, 100);

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Test timeout reached');
  server.kill();
  process.exit(1);
}, 30000);
