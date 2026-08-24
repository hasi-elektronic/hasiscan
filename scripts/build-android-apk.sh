#!/bin/sh
set -eu
cd /workspace

SDK="${ANDROID_SDK_ROOT:-/tmp/android-sdk}"
GRADLE="${GRADLE_BIN:-/tmp/gradle/gradle-8.7/bin/gradle}"
APP_DIR="/workspace/native/android"
WWW="$APP_DIR/app/src/main/assets"
OUT_APK="/workspace/public/native/HasiScan.apk"

if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "Android SDK missing at $SDK" >&2
  exit 1
fi
if [ ! -x "$GRADLE" ]; then
  echo "Gradle missing at $GRADLE" >&2
  exit 1
fi

if [ ! -d /workspace/.vercel/output/static/assets ]; then
  echo "Production static assets missing — run npm run build first" >&2
  exit 1
fi

# Preview the production build so we can snapshot the SSR HTML.
if ! curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8081/; then
  echo "Starting production preview on 8081..."
  npm run preview >/tmp/hasiscan-preview.log 2>&1 &
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8081/; then
      break
    fi
    sleep 1
  done
fi

rm -rf "$WWW"
mkdir -p "$WWW"
cp -a /workspace/.vercel/output/static/. "$WWW/"
curl -sf http://127.0.0.1:8081/ > "$WWW/index.html"
# SPA fallbacks for WebView asset loader
for page in scan qr library settings get-app; do
  cp "$WWW/index.html" "$WWW/$page.html"
done

# Launcher icons
python3 - <<'PY'
from pathlib import Path
from PIL import Image
src = Image.open("/workspace/public/icons/icon-512.png")
root = Path("/workspace/native/android/app/src/main/res")
sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
for folder, size in sizes.items():
    dest = root / folder
    dest.mkdir(parents=True, exist_ok=True)
    src.resize((size, size), Image.Resampling.LANCZOS).save(dest / "ic_launcher.png", "PNG")
print("launcher icons written")
PY

printf 'sdk.dir=%s\n' "$SDK" > "$APP_DIR/local.properties"

export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"
export PATH="$SDK/platform-tools:$SDK/cmdline-tools/latest/bin:$PATH"

cd "$APP_DIR"
"$GRADLE" --no-daemon assembleRelease

mkdir -p "$(dirname "$OUT_APK")"
cp -f "$APP_DIR/app/build/outputs/apk/release/app-release.apk" "$OUT_APK"
ls -lh "$OUT_APK"
echo "APK_OK $OUT_APK"
