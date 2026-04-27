import pexpect
import sys

print("Spawning tauri signer...")
child = pexpect.spawn("npx tauri signer generate -w ./updater_with_pass.key --force", timeout=10)
child.expect("Password:")
child.sendline("password123")
child.expect("Password \\(one more time\\):")
child.sendline("password123")
child.expect(pexpect.EOF)
print(child.before.decode())
