import { BookScraper, ProxyResponse, ScrapingOptions } from './types';

export class KyoboScraper implements BookScraper {
  name = 'Kyobo';
  private readonly baseUrl = 'https://search.kyobobook.co.kr';
  private readonly proxyUrl = 'https://api.allorigins.win/get?url=';

  constructor(private options: ScrapingOptions = {}) {}

  async scrape(isbn: string, title?: string): Promise<string> {
    try {
      // ISBN으로 검색 시도
      if (isbn) {
        const tocByISBN = await this.scrapeByISBN(isbn);
        if (tocByISBN) return tocByISBN;
      }

      // 제목으로 검색 시도
      if (title) {
        return await this.scrapeByTitle(title);
      }

      return '';
    } catch (error) {
      console.error(`Kyobo scraping failed:`, error);
      return '';
    }
  }

  private async scrapeByISBN(isbn: string): Promise<string> {
    const searchUrl = `${this.baseUrl}/web/search?vPstrKeyWord=${encodeURIComponent(isbn)}`;
    const html = await this.fetchHTML(searchUrl);

    if (!html) return '';

    // 검색 결과에서 첫 번째 도서의 상세 페이지 링크 추출
    const detailUrl = this.extractDetailUrl(html);
    if (!detailUrl) return '';

    return await this.scrapeDetailPage(detailUrl);
  }

  private async scrapeByTitle(title: string): Promise<string> {
    const cleanTitle = title.replace(/[^\w\s가-힣]/g, '').trim();
    const searchUrl = `${this.baseUrl}/web/search?vPstrKeyWord=${encodeURIComponent(cleanTitle)}`;
    const html = await this.fetchHTML(searchUrl);

    if (!html) return '';

    const detailUrl = this.extractDetailUrl(html);
    if (!detailUrl) return '';

    return await this.scrapeDetailPage(detailUrl);
  }

  private async fetchHTML(url: string): Promise<string> {
    try {
      const proxyRequest = this.proxyUrl + encodeURIComponent(url);
      const response = await fetch(proxyRequest, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ProxyResponse = await response.json();
      return data.contents || '';
    } catch (error) {
      console.error('Failed to fetch HTML:', error);
      return '';
    }
  }

  private extractDetailUrl(html: string): string | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 검색 결과 첫 번째 책의 링크 찾기
    const selectors = [
      '.prod_info .title a',
      '.list_search_result .title a',
      '.search_list .prod_area .title a',
      '.prod_item .title a'
    ];

    for (const selector of selectors) {
      const link = doc.querySelector(selector) as HTMLAnchorElement;
      if (link && link.href) {
        // 상대 URL인 경우 절대 URL로 변환
        return link.href.startsWith('http') ? link.href : `${this.baseUrl}${link.href}`;
      }
    }

    return null;
  }

  private async scrapeDetailPage(url: string): Promise<string> {
    const html = await this.fetchHTML(url);
    if (!html) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 교보문고 목차 추출 시도 (여러 선택자)
    const tocSelectors = [
      '#tabContent2',           // 목차 탭 내용
      '.tab_contents .book_contents', // 도서 목차 영역
      '.prod_detail_item:nth-child(2)', // 상세 정보 두 번째 항목
      '.book_index',            // 도서 색인
      '.table_of_contents',     // 목차 테이블
      '.contents_wrap',         // 목차 래퍼
      '[data-tab="contents"]'   // 목차 데이터 속성
    ];

    for (const selector of tocSelectors) {
      const tocElement = doc.querySelector(selector);
      if (tocElement && tocElement.textContent) {
        const toc = this.cleanTOC(tocElement.textContent);
        if (toc.length > 50) { // 최소 길이 체크
          return toc;
        }
      }
    }

    return '';
  }

  private cleanTOC(rawToc: string): string {
    return rawToc
      .replace(/\s+/g, ' ')                    // 중복 공백을 단일 공백으로
      .replace(/^\s*목차\s*/i, '')             // '목차' 제목 제거
      .replace(/^\s*차례\s*/i, '')             // '차례' 제목 제거
      .replace(/^\s*contents\s*/i, '')         // 'contents' 제목 제거
      .replace(/\n\s*\n/g, '\n')               // 연속된 빈 줄을 하나로
      .replace(/^\s*\n/, '')                   // 시작 빈 줄 제거
      .replace(/\n\s*$/, '')                   // 마지막 빈 줄 제거
      .replace(/\s*\.{3,}\s*/g, ' ... ')       // 점선을 정리
      .replace(/\s*…+\s*/g, ' ... ')           // 줄임표 정리
      .split('\n')
      .filter(line => line.trim().length > 2)  // 너무 짧은 줄 제거
      .join('\n')
      .trim();
  }
}