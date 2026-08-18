#!/usr/bin/env node

/**
 * Certificate Reminder Desktop App Launcher
 *
 * This script:
 * 1. Starts the Next.js development server
 * 2. Opens the default browser to localhost:3030
 * 3. Handles graceful shutdown
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const PORT = 3030;
const APP_URL = `http://localhost:${PORT}`;
const PROJECT_ROOT = path.dirname(__dirname);
const NODE_BIN = process.execPath;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let serverProcess = null;
let browserOpened = false;

/**
 * Open the default browser
 */
function openBrowser() {
  const openCommand = process.platform === 'darwin' ? 'open' :
                     process.platform === 'win32' ? 'start' : 'xdg-open';

  return spawn(openCommand, [APP_URL], {
    detached: true,
    stdio: 'ignore',
    shell: true
  });
}

/**
 * Shutdown the server gracefully
 */
function shutdownServer() {
  console.log(`\n${colors.yellow}Shutting down server...${colors.reset}`);

  if (serverProcess) {
    // Try graceful shutdown first
    serverProcess.kill('SIGTERM');

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        console.log(`${colors.red}Force killing server...${colors.reset}`);
        serverProcess.kill('SIGKILL');
      }
      process.exit(0);
    }, 5000);
  } else {
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', shutdownServer);
process.on('SIGTERM', shutdownServer);
process.on('exit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

// Start the server
console.log(`${colors.blue}========================================${colors.reset}`);
console.log(`${colors.blue}Certificate Reminder Desktop App${colors.reset}`);
console.log(`${colors.blue}========================================${colors.reset}`);
console.log(`${colors.cyan}Starting server...${colors.reset}`);

// Check if node_modules exists
const nodeModulesPath = path.join(PROJECT_ROOT, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.error(`${colors.red}Error: node_modules not found!${colors.reset}`);
  console.error(`${colors.yellow}Please run: npm install${colors.reset}`);
  process.exit(1);
}

// Check if .next build exists
const nextBuildPath = path.join(PROJECT_ROOT, '.next');
if (!fs.existsSync(nextBuildPath) || !fs.existsSync(path.join(nextBuildPath, 'server'))) {
  console.log(`${colors.yellow}Building application (one-time, this may take a minute)...${colors.reset}`);

  const buildProcess = spawn(NODE_BIN, ['node_modules/.bin/next', 'build'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });

  buildProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${colors.red}Build failed!${colors.reset}`);
      process.exit(1);
    }
    console.log(`${colors.green}✓ Build complete!${colors.reset}\n`);
    startProductionServer();
  });

  buildProcess.on('error', (err) => {
    console.error(`${colors.red}Build error: ${err.message}${colors.reset}`);
    process.exit(1);
  });
} else {
  startProductionServer();
}

function startProductionServer() {
  console.log(`${colors.cyan}Starting server...${colors.reset}`);

  // Start Next.js production server (more stable than dev mode)
  serverProcess = spawn(NODE_BIN, ['node_modules/.bin/next', 'start'], {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    env: { ...process.env, PORT: PORT.toString(), NODE_ENV: 'production' }
  });

  // Production server starts quickly - open browser after a short delay
  setTimeout(() => {
    if (!browserOpened) {
      browserOpened = true;
      console.log(`${colors.green}✓ Server ready!${colors.reset}`);
      console.log(`${colors.green}✓ Running on: ${APP_URL}${colors.reset}`);
      console.log(`${colors.green}✓ Opening browser...${colors.reset}`);
      openBrowser().unref();
      console.log(`\n${colors.yellow}Press Ctrl+C to stop the server${colors.reset}\n`);
    }
  }, 2000);

  // Handle server output
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    // Only show errors, not normal output
    if (output.includes('error') || output.includes('Error')) {
      console.error(`${colors.red}${output.trim()}${colors.reset}`);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const output = data.toString();
    // Only show actual errors, suppress warnings
    if (output.includes('error') || output.includes('Error')) {
      console.error(`${colors.red}${output.trim()}${colors.reset}`);
    }
  });

  // Handle server exit
  serverProcess.on('exit', (code) => {
    console.log(`${colors.yellow}Server exited with code ${code}${colors.reset}`);
    shutdownServer();
  });

  serverProcess.on('error', (error) => {
    console.error(`${colors.red}Failed to start server: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}
