#!/usr/bin/env node

/**
 * Debug script to check valid Redmine values (statuses, etc.)
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Redmine値調査 - 有効なステータス、優先度などを確認...\n');

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

// Check environment variables
if (!process.env.REDMINE_URL || !process.env.REDMINE_API_KEY) {
  console.log('❌ Redmine configuration not found');
  process.exit(1);
}

console.log(`✅ Redmine URL: ${process.env.REDMINE_URL}`);

// First, get current issue details to see available values
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

const getIssueMessage = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'redmine_get_issue',
    arguments: {
      issue_id: 9178,
      include: 'journals'
    }
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
        console.log('✅ Server initialized');
      } else if (response.id === 2) {
        if (response.error) {
          console.log('❌ Failed to get issue details:');
          console.log(`   Error: ${response.error.message}`);
        } else {
          console.log('✅ Issue details retrieved successfully!');
          console.log('\n📋 課題 #9178 の現在の状態:');
          
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            console.log(text);
            
            // Look for specific values in the response
            const lines = text.split('\n');
            lines.forEach(line => {
              if (line.includes('Status:') || 
                  line.includes('Priority:') || 
                  line.includes('Progress:') ||
                  line.includes('Tracker:')) {
                console.log(`🔍 ${line.trim()}`);
              }
            });
          }
        }
        
        server.kill();
        process.exit(0);
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
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

// Send test messages
setTimeout(() => {
  server.stdin.write(JSON.stringify(initMessage) + '\n');
}, 100);

setTimeout(() => {
  server.stdin.write(JSON.stringify(getIssueMessage) + '\n');
}, 500);

// Timeout after 10 seconds
setTimeout(() => {
  console.log('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 10000);
