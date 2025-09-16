# 목차 추출 시스템 가이드 (TOC Extraction System Guide)

## 개요 (Overview)

한국국립중앙도서관 API를 통한 도서 목차 추출을 위한 종합적인 시스템입니다. 여러 추출 방법을 통해 높은 성공률을 달성합니다.

## 시스템 구조 (System Architecture)

### 1. 고급 추출기 (Advanced Extractor) - `toc-extractor.ts`
6가지 추출 방법을 순차적으로 시도하여 최고 신뢰도의 결과를 반환:

1. **JSON-LD 추출**: 구조화된 데이터에서 목차 정보 추출
2. **메타데이터 추출**: HTML 메타태그에서 목차 정보 추출
3. **직접 API 호출**: 국립중앙도서관 내부 API 직접 호출
4. **검색 결과 추출**: 검색 결과 페이지에서 목차 정보 추출
5. **다중 URL 패턴**: 여러 URL 형식으로 목차 페이지 접근
6. **향상된 HTML 파싱**: 고급 HTML 분석으로 목차 추출

### 2. 세션 기반 서비스 (Session-based Service) - `toc-service.ts`
인증된 세션을 통한 목차 추출:
- BOOK_TB_CNT_URL 방식
- 상세 페이지 HTML 파싱
- TXT 파일 다운로드

### 3. 성능 모니터링 (Performance Monitoring) - `toc-performance.ts`
- 성공률 추적
- 방법별 통계
- 응답시간 모니터링
- 신뢰도 분포 분석
- 개선 권장사항 제공

## 사용법 (Usage)

### API 클래스에서의 사용
```typescript
const api = new NationalLibraryAPI(apiKey);
const tocResult = await api.fetchTableOfContentsWithSession(book);

if (tocResult.success) {
  console.log(`목차 추출 성공: ${tocResult.method}`);
  book.tableOfContents = tocResult.content;
}
```

### 추출 우선순위
1. **고급 추출기** (신뢰도 ≥ 0.6)
2. **세션 기반 추출**
3. **기존 방식 폴백**

## 특징 (Features)

### 다중 추출 방법
- 6가지 고급 추출 방법
- 3가지 세션 기반 방법
- 자동 폴백 메커니즘

### 품질 보장
- 신뢰도 점수 (0-1)
- 응답시간 추적
- 오류 상세 정보

### 성능 최적화
- 병렬 처리 가능
- 캐싱 지원
- 통계 기반 최적화

## 통계 및 모니터링 (Statistics & Monitoring)

### 성능 메트릭
- 전체 성공률
- 방법별 성공률
- 평균 응답시간
- 신뢰도 분포

### 권장사항 자동 생성
- 성능 개선 제안
- 네트워크 상태 점검
- 설정 최적화 가이드

## 테스트 (Testing)

### 테스트 스크립트
```bash
node test-enhanced-toc.js [API_KEY]
```

### 테스트 내용
- JSON-LD 패턴 테스트
- 메타데이터 추출 테스트
- URL 패턴 검증
- 성능 벤치마크

## 설정 (Configuration)

### 환경 변수
```bash
export NLK_API_KEY="your_api_key_here"
```

### 고급 설정
- 디버그 모드 활성화
- 추출 방법 선택적 활성화
- 신뢰도 임계값 조정
- 타임아웃 설정

## 문제 해결 (Troubleshooting)

### 일반적인 문제
1. **API 키 오류**: 올바른 국립중앙도서관 API 키 확인
2. **네트워크 오류**: 방화벽 및 프록시 설정 확인
3. **낮은 성공률**: 통계 리포트를 통한 원인 분석

### 디버깅
- 콘솔 로그 확인
- 성능 리포트 생성
- 개별 메서드 테스트

## 향후 개선 사항 (Future Improvements)

1. **기계학습 기반 추출**: AI를 활용한 목차 인식
2. **실시간 모니터링**: 성능 대시보드
3. **사용자 피드백**: 수동 검증 시스템
4. **다국어 지원**: 영문 도서 목차 추출

## 기여 (Contributing)

새로운 추출 방법 추가나 성능 개선을 위한 기여를 환영합니다.

---

**마지막 업데이트**: 2025년 9월
**버전**: 1.0.0
**개발자**: Korean Book Search Plugin Team