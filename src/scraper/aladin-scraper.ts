import { BookScraper, ProxyResponse, ScrapingOptions } from './types';

export class AladinScraper implements BookScraper {
  name = 'Aladin';
  private readonly baseUrl = 'https://www.aladin.co.kr';
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
      console.error(`Aladin scraping failed:`, error);
      return '';
    }
  }

  private async scrapeByISBN(isbn: string): Promise<string> {
    const searchUrl = `${this.baseUrl}/search/wsearchresult.aspx?SearchWord=${encodeURIComponent(isbn)}`;
    const html = await this.fetchHTML(searchUrl);

    if (!html) return '';

    const detailUrl = this.extractDetailUrl(html);
    if (!detailUrl) return '';

    return await this.scrapeDetailPage(detailUrl);
  }

  private async scrapeByTitle(title: string): Promise<string> {
    const cleanTitle = title.replace(/[^\w\s가-힣]/g, '').trim();
    const searchUrl = `${this.baseUrl}/search/wsearchresult.aspx?SearchWord=${encodeURIComponent(cleanTitle)}&SearchTarget=All`;
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

    // 알라딘 검색 결과에서 첫 번째 책의 링크 찾기
    const selectors = [
      '.ss_book_box .ss_book_list .bo3 a',
      '.book_list .book_item a',
      '.itemS3-title a',
      '.item_info .bo3 a'
    ];

    for (const selector of selectors) {
      const link = doc.querySelector(selector) as HTMLAnchorElement;
      if (link && link.href) {
        // 상대 URL인 경우 절대 URL로 변환
        const url = link.href.startsWith('http') ? link.href : `${this.baseUrl}${link.href}`;
        // 알라딘 도서 상세 페이지인지 확인
        if (url.includes('ItemId=') || url.includes('/shop/wproduct.aspx')) {
          return url;
        }
      }
    }

    return null;
  }

  private async scrapeDetailPage(url: string): Promise<string> {
    const html = await this.fetchHTML(url);
    if (!html) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 알라딘 목차 추출 시도 (여러 선택자)
    const tocSelectors = [
      '#ContentAreaDiv .contents_WrapDiv',  // 목차 영역
      '.Ere_prod_article_wrap .Ere_prod_article_index', // 도서 목차
      '.tabContents3',                      // 목차 탭
      '.book_info_inner .book_contents',    // 도서 내용
      '.prod_detail .contents',             // 상세 목차
      '#div_ContentList',                   // 목차 리스트
      '.bookInfoContents'                   // 도서 정보 목차
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

    // 탭 기반 목차 시도
    const tocTab = doc.querySelector('a[href*="tab=3"], a[href*="ContentTab=3"]');
    if (tocTab) {
      // 목차 탭이 있지만 내용은 AJAX로 로드되는 경우
      const tocContent = doc.querySelector('#pnlContent3, #ContentArea3');
      if (tocContent && tocContent.textContent) {
        const toc = this.cleanTOC(tocContent.textContent);
        if (toc.length > 50) {
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
      .replace(/^\s*index\s*/i, '')            // 'index' 제목 제거
      .replace(/\n\s*\n/g, '\n')               // 연속된 빈 줄을 하나로
      .replace(/^\s*\n/, '')                   // 시작 빈 줄 제거
      .replace(/\n\s*$/, '')                   // 마지막 빈 줄 제거
      .replace(/\s*\.{3,}\s*/g, ' ... ')       // 점선을 정리
      .replace(/\s*…+\s*/g, ' ... ')           // 줄임표 정리
      .replace(/접기.*펼치기/g, '')             // 알라딘 특유의 접기/펼치기 텍스트 제거
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 2 &&
               !trimmed.includes('접기') &&
               !trimmed.includes('펼치기') &&
               !trimmed.includes('더보기');
      })
      .join('\n')
      .trim();
  }
}