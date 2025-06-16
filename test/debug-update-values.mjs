#!/usr/bin/env node

/**
 * Debug update functionality by comparing before/after values
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Redmine課題更新デバッグ - 更新前後の値を比較...\n');

// Load environment variables
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

if (!process.env.REDMINE_URL || !process.env.REDMINE_API_KEY) {
  console.log('❌ Redmine configuration not found');
  process.exit(1);
}

const testIssueId = 9178;

async function runMCPCommand(toolName, args) {
  return new Promise((resolve, reject) => {
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
          name: 'debug-client',
          version: '1.0.0'
        }
      }
    };

    const commandMessage = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
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
            server.kill();
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result?.content?.[0]?.text || '');
            }
          }
        } catch (e) {
          // Ignore non-JSON lines
        }
      });
    });

    server.stderr.on('data', (data) => {
      // Ignore server logs
    });

    server.on('error', (error) => {
      reject(error);
    });

    // Send messages
    setTimeout(() => {
      server.stdin.write(JSON.stringify(initMessage) + '\n');
    }, 100);

    setTimeout(() => {
      server.stdin.write(JSON.stringify(commandMessage) + '\n');
    }, 500);

    // Timeout
    setTimeout(() => {
      server.kill();
      reject(new Error('Timeout'));
    }, 10000);
  });
}

async function getIssueDetails() {
  return await runMCPCommand('redmine_get_issue', {
    issue_id: testIssueId,
    include: 'journals'
  });
}

async function updateIssue(updateParams) {
  return await runMCPCommand('redmine_update_issue', {
    issue_id: testIssueId,
    ...updateParams
  });
}

function extractValue(text, label) {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.includes(label + ':')) {
      return line.split(':')[1]?.trim() || 'Not found';
    }
  }
  return 'Not found';
}

async function testUpdate() {
  try {
    console.log('📋 ステップ1: 更新前の状態を取得');
    const beforeText = await getIssueDetails();
    
    const beforeStatus = extractValue(beforeText, 'Status');
    const beforeProgress = extractValue(beforeText, 'Done Ratio');
    const beforeDueDate = extractValue(beforeText, 'Due Date');
    const beforeEstimated = extractValue(beforeText, 'Estimated Hours');
    
    console.log(`   現在の状態:`);
    console.log(`   ステータス: ${beforeStatus}`);
    console.log(`   進捗率: ${beforeProgress}`);
    console.log(`   期日: ${beforeDueDate}`);
    console.log(`   予定工数: ${beforeEstimated}`);
    
    console.log('\n🔄 ステップ2: 課題を更新');
    const updateParams = {
      done_ratio: 75,
      due_date: '2025-08-15',
      estimated_hours: 12.5,
      notes: `デバッグテスト更新 - ${new Date().toLocaleString()}`
    };
    
    console.log(`   更新パラメータ:`);
    console.log(`   done_ratio: ${updateParams.done_ratio}`);
    console.log(`   due_date: ${updateParams.due_date}`);
    console.log(`   estimated_hours: ${updateParams.estimated_hours}`);
    
    const updateResult = await updateIssue(updateParams);
    console.log('\n   更新結果:');
    console.log(`   ${updateResult.split('\\n')[0]}`);
    
    console.log('\n📋 ステップ3: 更新後の状態を取得');
    // Wait a moment for the update to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const afterText = await getIssueDetails();
    
    const afterStatus = extractValue(afterText, 'Status');
    const afterProgress = extractValue(afterText, 'Done Ratio');
    const afterDueDate = extractValue(afterText, 'Due Date');
    const afterEstimated = extractValue(afterText, 'Estimated Hours');
    
    console.log(`   更新後の状態:`);
    console.log(`   ステータス: ${afterStatus}`);
    console.log(`   進捗率: ${afterProgress}`);
    console.log(`   期日: ${afterDueDate}`);
    console.log(`   予定工数: ${afterEstimated}`);
    
    console.log('\n📊 変更の比較:');
    console.log(`   進捗率: ${beforeProgress} → ${afterProgress} ${afterProgress.includes('75') ? '✅' : '❌'}`);
    console.log(`   期日: ${beforeDueDate} → ${afterDueDate} ${afterDueDate.includes('2025-08-15') ? '✅' : '❌'}`);
    console.log(`   予定工数: ${beforeEstimated} → ${afterEstimated} ${afterEstimated.includes('12.5') ? '✅' : '❌'}`);
    
    // Check if any values actually changed
    const progressChanged = afterProgress !== beforeProgress && afterProgress.includes('75');
    const dueDateChanged = afterDueDate !== beforeDueDate && afterDueDate.includes('2025-08-15');
    const estimatedChanged = afterEstimated !== beforeEstimated && afterEstimated.includes('12.5');
    
    if (progressChanged && dueDateChanged && estimatedChanged) {
      console.log('\n🎉 すべての更新が正常に適用されました！');
    } else {
      console.log('\n⚠️ 一部の更新が適用されていません:');
      if (!progressChanged) console.log('   - 進捗率が更新されていません');
      if (!dueDateChanged) console.log('   - 期日が更新されていません');
      if (!estimatedChanged) console.log('   - 予定工数が更新されていません');
      
      console.log('\n🔍 詳細なレスポンスデータ:');
      console.log('更新前:');
      console.log(beforeText);
      console.log('\n更新後:');
      console.log(afterText);
    }
    
  } catch (error) {
    console.error('❌ テスト中にエラーが発生:', error.message);
    process.exit(1);
  }
}

console.log('🚀 デバッグテストを開始...');
testUpdate();
