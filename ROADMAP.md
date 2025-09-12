# 개발 로드맵 및 향후 기능

## 📌 현재 구현된 기능 (v1.0.0)
- ✅ 키워드 검색
- ✅ ISBN 검색
- ✅ 노트 자동 생성
- ✅ 커스터마이징 가능한 템플릿
- ✅ 폴더 자동 생성

## 🚀 계획된 기능 (v1.1.0)

### 1. 고급 검색 기능
- [ ] 상세 검색 (제목, 저자, 출판사 동시 검색)
- [ ] 발행년도 범위 검색
- [ ] 분류별 검색 (KDC/DDC)
- [ ] 검색 히스토리 저장

### 2. 도서 정보 확장
```typescript
// 추가할 정보
interface ExtendedBook {
  // 기존 정보 + 
  tableOfContentsUrl?: string;  // 목차 URL에서 실제 내용 가져오기
  summaryContent?: string;       // 책 소개 URL에서 실제 내용 가져오기
  coverImageBase64?: string;     // 표지 이미지 다운로드
  relatedBooks?: Book[];         // 관련 도서 추천
}
```

### 3. 바코드 스캔 기능
- [ ] 모바일에서 카메라로 ISBN 바코드 스캔
- [ ] 자동 ISBN 인식 및 검색

### 4. 독서 관리 기능
```typescript
interface ReadingStatus {
  status: '읽기 전' | '읽는 중' | '완독';
  startDate?: string;
  endDate?: string;
  rating?: number;
  progress?: number;  // 읽은 페이지
  notes?: string[];   // 독서 노트
}
```

### 5. 통계 및 시각화
- [ ] 독서 통계 대시보드
- [ ] 월별/연도별 독서량 차트
- [ ] 장르별 분포도
- [ ] 독서 캘린더 뷰

## 🎯 v2.0.0 장기 목표

### 1. 다중 API 지원
```typescript
enum BookAPIProvider {
  NationalLibrary = '국립중앙도서관',
  Aladin = '알라딘',
  Yes24 = 'YES24',
  Kyobo = '교보문고'
}
```

### 2. AI 기능 통합
- [ ] ChatGPT/Claude API를 활용한 책 요약
- [ ] 자동 태그 생성
- [ ] 독서 노트 분석 및 인사이트

### 3. 소셜 기능
- [ ] 독서 노트 공유
- [ ] 추천 도서 리스트 공유
- [ ] 독서 모임 관리

### 4. 데이터 동기화
- [ ] 클라우드 백업
- [ ] 다른 독서 앱과 연동 (Goodreads, 리디북스 등)

## 💡 기여 가이드

### 버그 리포트
이슈를 제출할 때 다음 정보를 포함해주세요:
- Obsidian 버전
- 플러그인 버전
- 에러 메시지 (개발자 콘솔)
- 재현 단계

### 기능 제안
새로운 기능을 제안할 때:
1. 기존 이슈 확인
2. 상세한 사용 사례 설명
3. 가능하면 목업이나 예시 포함

### 코드 기여
1. Fork 후 feature 브랜치 생성
2. 코드 작성 및 테스트
3. Pull Request 제출

## 📝 개발 노트

### API 제한 사항
- 국립중앙도서관 API는 일일 요청 제한이 있음
- 대량 검색 시 throttling 필요
- ISBN API와 일반 검색 API의 응답 형식이 다름

### 성능 최적화
- 검색 결과 캐싱 고려
- 이미지 lazy loading
- 대용량 템플릿 처리 최적화

### 보안 고려사항
- API 키 암호화 저장
- XSS 방지를 위한 입력 검증
- 안전한 HTML 렌더링
