import { requestUrl, RequestUrlParam } from 'obsidian';
import {
  KakaoBookSearchResponse,
  KakaoSearchParams,
  KakaoBookDocument,
  IntegratedBookInfo
} from '../types/kakao-types';

/**
 * 카카오 Books API 클라이언트
 */
export class KakaoAPI {
  private readonly BASE_URL = 'https://dapi.kakao.com/v3/search/book';
  private debugMode = true;

  constructor(private apiKey: string) {}

  /**
   * 디버깅 로그 출력
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    if (!this.debugMode) return;

    const timestamp = new Date().toISOString();
    const prefix = `🥕 [KakaoAPI-${level.toUpperCase()}] ${timestamp}`;

    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data || '');
        break;
      case 'error':
        console.error(`${prefix} ${message}`, data || '');
        break;
    }
  }

  /**
   * 카카오 API 키 설정
   */
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    this.log('info', 'API 키가 설정되었습니다');
  }

  /**
   * API 키 유효성 검사
   */
  private validateApiKey(): boolean {
    if (!this.apiKey || this.apiKey.trim() === '') {
      this.log('error', '카카오 API 키가 설정되지 않았습니다');
      return false;
    }
    return true;
  }

  /**
   * 도서 검색
   */
  async searchBooks(params: KakaoSearchParams): Promise<KakaoBookDocument[]> {
    if (!this.validateApiKey()) {
      return [];
    }

    this.log('info', '카카오 도서 검색 시작', params);

    try {
      const searchParams = new URLSearchParams();
      searchParams.set('query', params.query);
      searchParams.set('sort', params.sort || 'accuracy');
      searchParams.set('page', String(params.page || 1));
      searchParams.set('size', String(params.size || 10));

      if (params.target) {
        searchParams.set('target', params.target);
      }

      const url = `${this.BASE_URL}?${searchParams.toString()}`;
      this.log('info', '요청 URL', url);

      const requestConfig: RequestUrlParam = {
        url,
        method: 'GET',
        headers: {
          'Authorization': `KakaoAK ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      };

      const response = await requestUrl(requestConfig);

      if (response.status !== 200) {
        throw new Error(`카카오 API 요청 실패: ${response.status}`);
      }

      const data: KakaoBookSearchResponse = response.json;
      this.log('info', `검색 결과: ${data.documents.length}개`, data.meta);

      return data.documents;

    } catch (error) {
      this.log('error', '카카오 도서 검색 실패', error);
      return [];
    }
  }

  /**
   * ISBN으로 도서 검색
   */
  async searchByISBN(isbn: string): Promise<KakaoBookDocument | null> {
    if (!isbn || isbn.trim() === '') {
      this.log('warn', 'ISBN이 제공되지 않았습니다');
      return null;
    }

    this.log('info', 'ISBN 검색 시작', { isbn });

    const results = await this.searchBooks({
      query: isbn,
      target: 'isbn',
      size: 1
    });

    if (results.length > 0) {
      this.log('info', 'ISBN 검색 성공', results[0]);
      return results[0];
    } else {
      this.log('warn', 'ISBN 검색 결과 없음', { isbn });
      return null;
    }
  }

  /**
   * 제목으로 도서 검색
   */
  async searchByTitle(title: string, size = 5): Promise<KakaoBookDocument[]> {
    if (!title || title.trim() === '') {
      this.log('warn', '제목이 제공되지 않았습니다');
      return [];
    }

    this.log('info', '제목 검색 시작', { title, size });

    return await this.searchBooks({
      query: title,
      target: 'title',
      size,
      sort: 'accuracy'
    });
  }

  /**
   * 카카오 도서 정보를 통합 도서 정보로 변환
   */
  convertToIntegratedBookInfo(kakaoBook: KakaoBookDocument): IntegratedBookInfo {
    return {
      title: kakaoBook.title,
      author: kakaoBook.authors.join(', '),
      publisher: kakaoBook.publisher,
      publishDate: kakaoBook.datetime.split('T')[0], // ISO 날짜에서 날짜 부분만 추출
      isbn: kakaoBook.isbn,

      // 카카오 추가 정보
      kakaoTitle: kakaoBook.title,
      kakaoUrl: kakaoBook.url,
      kakaoThumbnail: kakaoBook.thumbnail,
      kakaoContents: kakaoBook.contents,
      kakaoPrice: kakaoBook.price,
      kakaoSalePrice: kakaoBook.sale_price,

      // 소스 정보
      source: 'kakao',
      hasKakaoData: true
    };
  }

  /**
   * 여러 검색 조건으로 도서 찾기 (폴백 전략)
   */
  async findBookWithFallback(title: string, author?: string, isbn?: string): Promise<KakaoBookDocument | null> {
    this.log('info', '폴백 전략으로 도서 검색', { title, author, isbn });

    // 1. ISBN이 있으면 우선 ISBN으로 검색
    if (isbn) {
      const isbnResult = await this.searchByISBN(isbn);
      if (isbnResult) {
        this.log('info', 'ISBN 검색으로 도서 발견');
        return isbnResult;
      }
    }

    // 2. 정확한 제목으로 검색
    let titleResults = await this.searchByTitle(title, 3);
    if (titleResults.length > 0) {
      // 저자가 있으면 저자 매칭 시도
      if (author) {
        const authorMatch = titleResults.find(book =>
          book.authors.some(a => a.includes(author) || author.includes(a))
        );
        if (authorMatch) {
          this.log('info', '제목+저자 매칭으로 도서 발견');
          return authorMatch;
        }
      }

      this.log('info', '제목 검색으로 도서 발견');
      return titleResults[0];
    }

    // 3. 저자와 함께 검색
    if (author) {
      const combinedResults = await this.searchBooks({
        query: `${title} ${author}`,
        size: 3,
        sort: 'accuracy'
      });

      if (combinedResults.length > 0) {
        this.log('info', '제목+저자 통합 검색으로 도서 발견');
        return combinedResults[0];
      }
    }

    this.log('warn', '모든 검색 전략 실패');
    return null;
  }
}