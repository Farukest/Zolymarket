#!/usr/bin/env node

/**
 * Script to copy FHEVM WASM files to public directory
 * This ensures fhevmjs WASM files are accessible to the browser
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'node_modules', 'fhevmjs', 'bundle');
const targetDir = path.join(__dirname, '..', 'public');

const wasmFiles = ['tfhe_bg.wasm', 'kms_lib_bg.wasm'];

console.log('🔧 Copying FHEVM WASM files...');

try {
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  wasmFiles.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`✅ Copied ${file}`);
    } else {
      console.warn(`⚠️  Warning: ${file} not found in source directory`);
    }
  });

  console.log('🎉 WASM files copied successfully');
} catch (error) {
  console.error('❌ Error copying WASM files:', error);
  process.exit(1);
}