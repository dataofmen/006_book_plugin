#!/bin/bash

# 이전 경로에서 새 경로로 모든 파일 복사
OLD_PATH="/Users/hmkwon/kr-book-plugin"
NEW_PATH="/Users/hmkwon/Project/006_book_plugin"

echo "📁 파일 복사 중..."

# 설정 파일들
cp "$OLD_PATH/manifest.json" "$NEW_PATH/" 2>/dev/null
cp "$OLD_PATH/tsconfig.json" "$NEW_PATH/" 2>/dev/null
cp "$OLD_PATH/esbuild.config.mjs" "$NEW_PATH/" 2>/dev/null
cp "$OLD_PATH/versions.json" "$NEW_PATH/" 2>/dev/null
cp "$OLD_PATH/.gitignore" "$NEW_PATH/" 2>/dev/null
cp "$OLD_PATH/styles.css" "$NEW_PATH/" 2>/dev/null
cp "$OLD_PATH/README.md" "$NEW_PATH/" 2>/dev/null
cp "$OLD_PATH/ROADMAP.md" "$NEW_PATH/" 2>/dev/null
cp "$OLD_PATH/template-examples.md" "$NEW_PATH/" 2>/dev/null

# src 폴더 파일들
cp "$OLD_PATH/src/main.ts" "$NEW_PATH/src/" 2>/dev/null
cp "$OLD_PATH/src/settings.ts" "$NEW_PATH/src/" 2>/dev/null

# api 폴더
cp "$OLD_PATH/src/api/types.ts" "$NEW_PATH/src/api/" 2>/dev/null
cp "$OLD_PATH/src/api/nlk-api.ts" "$NEW_PATH/src/api/" 2>/dev/null

# ui 폴더
cp "$OLD_PATH/src/ui/search-modal.ts" "$NEW_PATH/src/ui/" 2>/dev/null
cp "$OLD_PATH/src/ui/settings-tab.ts" "$NEW_PATH/src/ui/" 2>/dev/null

# utils 폴더
cp "$OLD_PATH/src/utils/template.ts" "$NEW_PATH/src/utils/" 2>/dev/null
cp "$OLD_PATH/src/utils/debug.ts" "$NEW_PATH/src/utils/" 2>/dev/null

echo "✅ 복사 완료!"
