#!/usr/bin/env node

/**
 * Test script to create a test issue in Redmine
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Testing Redmine issue creation...\n');

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

// Start server
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
    clientInfo: { name: 'issue-test-client', version: '1.0.0' }
  }
};

// Create a test issue
const createIssueMessage = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'redmine_create_issue',
    arguments: {
      project_id: 136, // Using the SPV保守Tips project (confirmed working)
      tracker_id: 24,  // Tips tracker (confirmed to exist in this project)
      subject: `MCP Server Test Issue - ${new Date().toISOString()}`,
      description: 'This is a test issue created by the MCP integrated search server to verify Redmine API connectivity.'
    }
  }
};

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      
      if (response.id === 1) {
        console.log('✅ Server initialized');
      } else if (response.id === 2) {
        if (response.error) {
          console.log('❌ Issue creation failed:');
          console.log(`   Error: ${response.error.message}`);
        } else {
          console.log('✅ Test issue created successfully!');
          if (response.result?.content?.[0]?.text) {
            console.log('   Details:');
            console.log(`   ${response.result.content[0].text}`);
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

server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
  process.exit(1);
});

// Send messages
setTimeout(() => server.stdin.write(JSON.stringify(initMessage) + '\n'), 100);
setTimeout(() => server.stdin.write(JSON.stringify(createIssueMessage) + '\n'), 500);

// Timeout
setTimeout(() => {
  console.log('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 15000);
