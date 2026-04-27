const { execSync } = require('child_process');
const fs = require('fs');

console.log('Generating key without password...');

// We use the node API of @tauri-apps/cli to generate the key directly without interactive prompts
// Wait, @tauri-apps/cli does not expose a JS API for this easily.
// Instead, we can use the `minisign` rust CLI, or just pass empty password via environment!

try {
  execSync('export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" && npx tauri signer generate -w ./updater3.key --force', { stdio: 'inherit' });
} catch (e) {
  console.log('Failed to generate key', e);
}
