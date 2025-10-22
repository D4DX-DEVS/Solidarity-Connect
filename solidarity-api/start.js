#!/usr/bin/env node

/**
 * Solidarity API Startup Script
 * This script provides options to start the server or seed the database
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const command = args[0];

function runCommand(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function main() {
  console.log('🚀 Solidarity API Management');
  console.log('============================\n');

  try {
    switch (command) {
      case 'dev':
        console.log('🔧 Starting development server...');
        await runCommand('npm', ['run', 'dev']);
        break;

      case 'start':
        console.log('🚀 Starting production server...');
        await runCommand('npm', ['start']);
        break;

      case 'seed':
        console.log('🌱 Seeding database...');
        await runCommand('npm', ['run', 'seed']);
        break;

      case 'install':
        console.log('📦 Installing dependencies...');
        await runCommand('npm', ['install']);
        break;

      case 'setup':
        console.log('⚙️  Setting up project...');
        console.log('📦 Installing dependencies...');
        await runCommand('npm', ['install']);
        console.log('🌱 Seeding database...');
        await runCommand('npm', ['run', 'seed']);
        console.log('✅ Setup complete!');
        break;

      default:
        console.log('Available commands:');
        console.log('  dev     - Start development server with nodemon');
        console.log('  start   - Start production server');
        console.log('  seed    - Seed database with sample data');
        console.log('  install - Install dependencies');
        console.log('  setup   - Install dependencies and seed database');
        console.log('\nUsage: node start.js <command>');
        console.log('Example: node start.js dev');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();