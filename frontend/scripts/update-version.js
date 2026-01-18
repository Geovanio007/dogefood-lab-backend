// Script to update version.json before each build
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const versionFilePath = path.join(__dirname, '../public/version.json');

// Generate version info
const version = Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
const buildTime = new Date().toISOString();

// Try to get git commit hash
let commitHash = 'unknown';
try {
  commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (e) {
  console.log('Could not get git commit hash');
}

const versionData = {
  version,
  buildTime,
  commitHash
};

// Write version file
fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));

console.log(`[Version] Updated to ${version} (${commitHash})`);
