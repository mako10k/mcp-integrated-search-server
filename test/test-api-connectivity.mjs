#!/usr/bin/env node

/**
 * Test script to verify Google Custom Search API connectivity
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Testing Google Custom Search API connectivity...\n');

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
  stdio: ['pipe', 'pipe', 'inherit'],
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

const searchMessage = {
  jsonrpc: '2.0',
  id: 2,
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
  
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      responses.push(response);
      responseCount++;
      
      if (response.id === 1) {
        console.log('✅ Server initialized successfully');
        console.log(`   Protocol version: ${response.result?.protocolVersion || 'unknown'}`);
      } else if (response.id === 2) {
        if (response.error) {
          console.log('❌ API test failed:');
          console.log(`   Error: ${response.error.message}`);
          if (response.error.message.includes('quota')) {
            console.log('   💡 This might be due to API quota limits. The server setup is correct.');
          } else if (response.error.message.includes('API key')) {
            console.log('   💡 Please check your Google API key configuration.');
          }
        } else {
          console.log('✅ Google Custom Search API test successful');
          const content = response.result?.content || [];
          console.log(`   Found ${content.length} search results`);
          if (content.length > 0) {
            console.log(`   First result: ${content[0].title || 'No title'}`);
          }
        }
        
        console.log('\n🎉 API connectivity test completed.');
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
  server.stdin.write(JSON.stringify(searchMessage) + '\n');
}, 500);

// Timeout after 15 seconds
setTimeout(() => {
  console.log('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 15000);
