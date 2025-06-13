#!/usr/bin/env node

/**
 * Test script to verify new Redmine update tools are properly registered
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Testing new Redmine update tools registration...\n');

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

// Check required environment variables (only Google for basic tool listing)
if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
  console.log('❌ Google API configuration not found in .env file');
  process.exit(1);
}

console.log(`✅ Google API Key: ${process.env.GOOGLE_API_KEY.substring(0, 8)}...`);
console.log(`✅ Google Search Engine ID: ${process.env.GOOGLE_SEARCH_ENGINE_ID.substring(0, 8)}...`);

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
      name: 'tools-test-client',
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
          console.log('❌ Tools listing failed:');
          console.log(`   Error: ${response.error.message}`);
        } else {
          console.log('✅ Tools listing successful!');
          const tools = response.result?.tools || [];
          console.log(`   Total tools found: ${tools.length}`);
          
          // 期待されるツール（Google: 2個、Redmine基本: 4個、新ツール: 2個）
          const expectedGoogleTools = ['google_search', 'google_search_images'];
          const expectedRedmineTools = ['redmine_list_issues', 'redmine_create_issue', 'redmine_list_projects', 'redmine_get_issue'];
          const expectedNewTools = ['redmine_update_issue', 'redmine_bulk_update_issues'];
          
          const hasAllGoogleTools = expectedGoogleTools.every(tool => tools.some(t => t.name === tool));
          const hasAllRedmineTools = expectedRedmineTools.every(tool => tools.some(t => t.name === tool));
          const hasAllNewTools = expectedNewTools.every(tool => tools.some(t => t.name === tool));
          
          console.log('   Available tools:');
          tools.forEach(tool => {
            const isNew = expectedNewTools.includes(tool.name);
            const prefix = isNew ? '🆕' : '  ';
            console.log(`   ${prefix} ${tool.name} - ${tool.description}`);
          });
          
          if (tools.length >= 8 && hasAllGoogleTools && hasAllRedmineTools && hasAllNewTools) {
            console.log('\n🎉 All tests passed! New Redmine update tools are correctly registered.');
            console.log('   ✅ Google Custom Search tools available (2)');
            console.log('   ✅ Redmine API tools available (4)');
            console.log('   ✅ New Redmine update tools available (2)');
            console.log(`   ✅ Total tools: ${tools.length}/8 expected`);
          } else {
            console.log(`\n❌ Expected 8 tools (2 Google + 4 Redmine + 2 New)`);
            console.log(`   Found ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);
            
            if (!hasAllGoogleTools) {
              console.log('   ❌ Missing Google tools');
            }
            if (!hasAllRedmineTools) {
              console.log('   ❌ Missing Redmine tools');
            }
            if (!hasAllNewTools) {
              console.log('   ❌ Missing new Redmine update tools');
              expectedNewTools.forEach(tool => {
                if (!tools.some(t => t.name === tool)) {
                  console.log(`     Missing: ${tool}`);
                }
              });
            }
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
  server.stdin.write(JSON.stringify(listToolsMessage) + '\n');
}, 500);

// Timeout after 10 seconds
setTimeout(() => {
  console.log('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 10000);
