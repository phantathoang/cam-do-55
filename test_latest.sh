#!/bin/bash
mkdir -p src-tauri/target/release/bundle/macos
echo "fake_signature_content" > src-tauri/target/release/bundle/macos/C.m.D.55_aarch64.app.tar.gz.sig
export GITHUB_REF_NAME="v0.1.25"
SIG_FILE=$(find src-tauri/target/release/bundle/macos -name "*.app.tar.gz.sig" | head -n 1)
if [ -f "$SIG_FILE" ]; then
  SIG=$(<"$SIG_FILE")
  VERSION="$GITHUB_REF_NAME"
  VERSION=${VERSION#v}
  URL="https://github.com/phantathoang/cam-do-55/releases/download/$GITHUB_REF_NAME/C.m.D.55_aarch64.app.tar.gz"
  
  echo '{
    "version": "'"$VERSION"'",
    "notes": "Bản cập nhật '"$VERSION"'",
    "pub_date": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'",
    "platforms": {
      "darwin-aarch64": {
        "signature": "'"$SIG"'",
        "url": "'"$URL"'"
      },
      "darwin-x86_64": {
        "signature": "'"$SIG"'",
        "url": "'"$URL"'"
      }
    }
  }' > latest.json
  cat latest.json
else
  echo "ERROR: Signature file not found!"
fi
