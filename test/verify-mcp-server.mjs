#!/usr/bin/env node

/**
 * Simple test script to verify Integrated Search MCP server is working correctly
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Testing Integrated Search MCP Server (Google + Redmine)...\n');

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
  console.log('⚠️ Could not load .env file. Make sure environment variables are set manually.');
}

// Check required environment variables
const requiredVars = ['GOOGLE_API_KEY', 'GOOGLE_SEARCH_ENGINE_ID'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.log(`   ${varName}`));
  console.log('\nPlease set these variables in your .env file or environment.');
  process.exit(1);
}

console.log('✅ Environment variables are configured');

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
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

const listToolsMessage = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list',
  params: {}
};

let responseCount = 0;
let responses = [];

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      responses.push(response);
      responseCount++;
      
      if (response.id === 1) {
        console.log('✅ Server initialized successfully');
        console.log(`   Protocol version: ${response.result?.protocolVersion || 'unknown'}`);
      } else if (response.id === 2) {
        console.log('✅ Tools list received');
        const tools = response.result?.tools || [];
        console.log(`   Available tools: ${tools.map(t => t.name).join(', ')}`);
        
        // 期待されるツール（Google: 2個、Redmine: 4個）
        const expectedGoogleTools = ['google_search', 'google_search_images'];
        const expectedRedmineTools = ['redmine_list_issues', 'redmine_create_issue', 'redmine_list_projects', 'redmine_get_issue'];
        
        const hasAllGoogleTools = expectedGoogleTools.every(tool => tools.some(t => t.name === tool));
        const hasAllRedmineTools = expectedRedmineTools.every(tool => tools.some(t => t.name === tool));
        
        if (tools.length >= 6 && hasAllGoogleTools && hasAllRedmineTools) {
          console.log('\n🎉 All tests passed! Integrated Search MCP server is working correctly.');
          console.log('   ✅ Google Custom Search tools available');
          console.log('   ✅ Redmine API tools available');
        } else {
          console.log(`\n❌ Expected 6 tools (2 Google + 4 Redmine tools)`);
          console.log(`   Found ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);
          
          if (!hasAllGoogleTools) {
            console.log('   ❌ Missing Google tools');
          }
          if (!hasAllRedmineTools) {
            console.log('   ❌ Missing Redmine tools');
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

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

// Send test messages
setTimeout(() => {
  server.stdin.write(JSON.stringify(initMessage) + '\n');
}, 100);

setTimeout(() => {
  server.stdin.write(JSON.stringify(listToolsMessage) + '\n');
}, 500);

// Timeout after 10 seconds
setTimeout(() => {
  console.log('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 10000);
