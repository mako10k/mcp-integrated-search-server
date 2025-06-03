#!/usr/bin/env node

/**
 * Test script to verify Redmine API connectivity
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Testing Redmine API connectivity...\n');

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
      name: 'redmine-test-client',
      version: '1.0.0'
    }
  }
};

const listProjectsMessage = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'redmine_list_projects',
    arguments: {
      limit: 5
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
        console.log('✅ Server initialized successfully');
        console.log(`   Protocol version: ${response.result?.protocolVersion || 'unknown'}`);
      } else if (response.id === 2) {
        if (response.error) {
          console.log('❌ Redmine API test failed:');
          console.log(`   Error: ${response.error.message}`);
        } else {
          console.log('✅ Redmine API test successful!');
          console.log('   Projects retrieved successfully');
          if (response.result?.content?.[0]?.text) {
            const text = response.result.content[0].text;
            const lines = text.split('\n').slice(0, 10); // First 10 lines
            console.log('   Preview:');
            lines.forEach(line => console.log(`     ${line}`));
          }
        }
        
        server.kill();
        process.exit(0);
      }
    } catch (e) {
      // Ignore non-JSON lines (like log messages)
    }
  });
});

server.stderr.on('data', (data) => {
  console.log('Server stderr:', data.toString());
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
  server.stdin.write(JSON.stringify(listProjectsMessage) + '\n');
}, 500);

// Timeout after 15 seconds
setTimeout(() => {
  console.log('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 15000);
