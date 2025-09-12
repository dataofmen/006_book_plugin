#!/bin/bash

# Korean Book Search Plugin Auto Install

echo "📚 Korean Book Search Plugin 자동 설치"
echo "======================================="
echo ""

# 변수 설정
PROJECT_PATH="/Users/hmkwon/Project/006_book_plugin"
VAULT_PATH="/Users/hmkwon/Library/Mobile Documents/iCloud~md~obsidian/Documents/claudesidian"
PLUGIN_PATH="$VAULT_PATH/.obsidian/plugins/kr-book-search"

echo "📁 프로젝트 경로: $PROJECT_PATH"
echo "📁 Obsidian 보관소: $VAULT_PATH"
echo ""

# 프로젝트 디렉토리로 이동
cd "$PROJECT_PATH"

# 빌드 확인 (이미 빌드가 진행 중이므로 대기)
echo "⏳ 빌드 완료 대기 중..."
sleep 5

# main.js 파일이 생성될 때까지 대기
while [ ! -f "$PROJECT_PATH/main.js" ]; do
    echo "⏳ 빌드 진행 중..."
    sleep 2
done

echo "✅ 빌드 완료!"
echo ""

# 파일 복사
echo "📄 플러그인 파일 복사 중..."

cp "$PROJECT_PATH/main.js" "$PLUGIN_PATH/" && echo "  ✓ main.js 복사 완료"
cp "$PROJECT_PATH/manifest.json" "$PLUGIN_PATH/" && echo "  ✓ manifest.json 복사 완료"
cp "$PROJECT_PATH/styles.css" "$PLUGIN_PATH/" && echo "  ✓ styles.css 복사 완료"

echo ""
echo "✅ 설치 완료!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "다음 단계:"
echo ""
echo "1. Obsidian 재시작 (Cmd+Q로 종료 후 다시 실행)"
echo ""
echo "2. 설정 → 커뮤니티 플러그인"
echo "   - '제한 모드 끄기' 클릭"
echo "   - 'Korean Book Search' 활성화"
echo ""
echo "3. 설정 → Korean Book Search"
echo "   - API 키 입력"
echo "   - 노트 저장 폴더 설정 (예: Books)"
echo ""
echo "4. 사용 방법:"
echo "   - Cmd+P → '도서 검색'"
echo "   - 또는 왼쪽 리본 바의 📚 아이콘 클릭"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
