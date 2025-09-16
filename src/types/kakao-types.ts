// 카카오 Books API 타입 정의

/**
 * 카카오 도서 검색 API 응답 타입
 */
export interface KakaoBookSearchResponse {
  documents: KakaoBookDocument[];
  meta: KakaoBookMeta;
}

/**
 * 카카오 도서 정보
 */
export interface KakaoBookDocument {
  title: string;
  contents: string;
  url: string;
  isbn: string;
  datetime: string;
  authors: string[];
  publisher: string;
  translators: string[];
  price: number;
  sale_price: number;
  thumbnail: string;
  status: string;
}

/**
 * 카카오 검색 메타 정보
 */
export interface KakaoBookMeta {
  total_count: number;
  pageable_count: number;
  is_end: boolean;
}

/**
 * 카카오 검색 파라미터
 */
export interface KakaoSearchParams {
  query: string;
  sort?: 'accuracy' | 'latest';
  page?: number;
  size?: number;
  target?: 'title' | 'isbn' | 'publisher' | 'person';
}

/**
 * 카카오 도서 상세 페이지 목차 추출 결과
 */
export interface KakaoTOCResult {
  success: boolean;
  content?: string;
  error?: string;
  source: 'detail-page' | 'fallback';
  kakaoUrl?: string;
}

/**
 * 카카오 목차 추출 설정
 */
export interface KakaoTOCConfig {
  enabled: boolean;
  maxRetries: number;
  timeout: number;
  fallbackToNLK: boolean;
}

/**
 * 카카오 API 설정
 */
export interface KakaoAPIConfig {
  apiKey: string;
  baseUrl: string;
  tocConfig: KakaoTOCConfig;
}

/**
 * 통합 도서 정보 (NLK + 카카오)
 */
export interface IntegratedBookInfo {
  // 기본 정보 (NLK 우선)
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  isbn: string;

  // 카카오 추가 정보
  kakaoTitle?: string;
  kakaoUrl?: string;
  kakaoThumbnail?: string;
  kakaoContents?: string;
  kakaoPrice?: number;
  kakaoSalePrice?: number;
  kakaoTableOfContents?: string;

  // 소스 표시
  source: 'nlk' | 'kakao' | 'integrated';
  hasKakaoData: boolean;
}