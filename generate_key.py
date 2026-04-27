import pexpect
import sys

print("Spawning tauri signer...")
child = pexpect.spawn("npx tauri signer generate -w ./updater_final.key --force", timeout=10)
child.expect("Password:")
child.sendline("")
child.expect("Password \\(one more time\\):")
child.sendline("")
child.expect(pexpect.EOF)
print(child.before.decode())
