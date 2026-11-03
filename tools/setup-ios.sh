#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "iOS app creation requires a Mac with Xcode." >&2
  exit 1
fi
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Install Xcode and Xcode Command Line Tools first." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js 22 or newer first." >&2
  exit 1
fi

echo "Installing pinned Capacitor 8 dependencies…"
npm install --save-exact @capacitor/core@8.6.0 @capacitor/ios@8.6.0
npm install --save-dev --save-exact @capacitor/cli@8.6.0
node tools/prepare-ios.mjs
if [[ ! -d ios ]]; then
  npx cap add ios
else
  npx cap sync ios
fi

echo
echo "iOS project is prepared."
echo "Open Xcode with: npx cap open ios"
echo "In Xcode, select your Apple Developer Team under Signing & Capabilities."
echo "Before App Store submission: set a final unique bundle ID, app icon, privacy disclosures, and test on a real iPhone."
