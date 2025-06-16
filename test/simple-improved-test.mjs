#!/usr/bin/env node

/**
 * Simple test for improved update functionality
 */

import { spawn } from 'child_process';

console.log('🧪 Simple Improved Update Test...\n');

const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: '/home/solar/mcp-redmine',
  env: {
    ...process.env,
    GOOGLE_API_KEY: 'AIzaSyBBvo8t3hn4AOxG4PxiNoc-PlvI0vFNv4g',
    GOOGLE_SEARCH_ENGINE_ID: '7313b1ea006ad4112',
    REDMINE_URL: 'https://redmine.sp-viewer.net',
    REDMINE_API_KEY: '2cd7e3c8f4ea5dc33fac698fd6bcd707967934d7',
    LOG_LEVEL: 'debug'
  }
});

let responses = 0;
const maxResponses = 3;

server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
  responses++;
  if (responses >= maxResponses) {
    server.kill();
  }
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

// 1. Initialize
setTimeout(() => {
  const init = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}\n';
  server.stdin.write(init);
}, 100);

// 2. Test improved update
setTimeout(() => {
  const update = '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"redmine_update_issue","arguments":{"issue_id":9191,"done_ratio":60,"notes":"Improved update test"}}}\n';
  server.stdin.write(update);
}, 1000);

// 3. Exit
setTimeout(() => {
  server.kill();
  process.exit(0);
}, 5000);
