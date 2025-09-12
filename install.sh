#!/bin/bash

# Quick Install Script for Korean Book Search Plugin

echo "📚 Korean Book Search Plugin 빠른 설치 스크립트"
echo "================================================"
echo ""

# Obsidian 보관소 경로 입력받기
read -p "Obsidian 보관소 경로를 입력하세요 (예: ~/Documents/ObsidianVault): " VAULT_PATH

# 경로 확장
VAULT_PATH="${VAULT_PATH/#\~/$HOME}"

# 보관소 존재 확인
if [ ! -d "$VAULT_PATH" ]; then
    echo "❌ 오류: 지정된 경로가 존재하지 않습니다: $VAULT_PATH"
    exit 1
fi

# .obsidian 폴더 확인
if [ ! -d "$VAULT_PATH/.obsidian" ]; then
    echo "❌ 오류: 유효한 Obsidian 보관소가 아닙니다 (.obsidian 폴더가 없음)"
    exit 1
fi

echo "✅ Obsidian 보관소 확인: $VAULT_PATH"
echo ""

# 플러그인 폴더 생성
PLUGIN_PATH="$VAULT_PATH/.obsidian/plugins/kr-book-search"
mkdir -p "$PLUGIN_PATH"
echo "📁 플러그인 폴더 생성: $PLUGIN_PATH"

# 의존성 설치
echo ""
echo "📦 의존성 설치 중..."
npm install

# 빌드
echo ""
echo "🔨 플러그인 빌드 중..."
npm run build

# 파일 복사
echo ""
echo "📄 파일 복사 중..."
cp main.js "$PLUGIN_PATH/"
cp manifest.json "$PLUGIN_PATH/"
cp styles.css "$PLUGIN_PATH/"

echo ""
echo "✅ 설치 완료!"
echo ""
echo "다음 단계:"
echo "1. Obsidian을 재시작하세요"
echo "2. 설정 → 커뮤니티 플러그인 → Korean Book Search 활성화"
echo "3. 설정에서 국립중앙도서관 API 키 입력"
echo ""
echo "API 키 발급: https://www.nl.go.kr/NL/contents/N31101030700.do"
echo ""
echo "즐거운 독서 기록 되세요! 📖"
