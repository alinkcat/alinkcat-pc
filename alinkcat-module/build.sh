#!/usr/bin/env bash
# pack the alinkcat module zip
# standard Magisk/KSU module layout

set -e
cd "$(dirname "$0")"

VERSION="v1.0.0"
OUTPUT_DIR="dist"
MODULE_NAME="alinkcat-module-${VERSION}"

echo "== 构建艾联猫 Root 模块 ${VERSION} =="

# clean
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# pack
echo "- 打包模块..."
zip -r "${OUTPUT_DIR}/${MODULE_NAME}.zip" \
  META-INF/ \
  module.prop \
  customize.sh \
  bin/ \
  scripts/ \
  config/ \
  system/ \
  -x "*.DS_Store" \
  -x "src/*" \
  -x "doc/*" \
  -x "dist/*" \
  -x ".gitignore"

echo "- 校验..."
unzip -l "${OUTPUT_DIR}/${MODULE_NAME}.zip" | head -30
echo "..."

echo "✔ 构建完成: ${OUTPUT_DIR}/${MODULE_NAME}.zip"
echo "  大小: $(du -h "${OUTPUT_DIR}/${MODULE_NAME}.zip" | cut -f1)"