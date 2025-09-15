import { BookScraper, ProxyResponse, ScrapingOptions } from './types';

export class Yes24Scraper implements BookScraper {
  name = 'YES24';
  private readonly baseUrl = 'http://www.yes24.com';
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
      console.error(`YES24 scraping failed:`, error);
      return '';
    }
  }

  private async scrapeByISBN(isbn: string): Promise<string> {
    const searchUrl = `${this.baseUrl}/searchCorner/Search?domain=ALL&query=${encodeURIComponent(isbn)}`;
    const html = await this.fetchHTML(searchUrl);

    if (!html) return '';

    const detailUrl = this.extractDetailUrl(html);
    if (!detailUrl) return '';

    return await this.scrapeDetailPage(detailUrl);
  }

  private async scrapeByTitle(title: string): Promise<string> {
    const cleanTitle = title.replace(/[^\w\s가-힣]/g, '').trim();
    const searchUrl = `${this.baseUrl}/searchCorner/Search?domain=ALL&query=${encodeURIComponent(cleanTitle)}`;
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

    // YES24 검색 결과에서 첫 번째 책의 링크 찾기
    const selectors = [
      '#yesSchList .goodsList .goods_info .goods_name a',
      '.goodsList .item .gd_name a',
      '.searchResult .goods_info .goods_name a',
      '.schGoods .gd_name a'
    ];

    for (const selector of selectors) {
      const link = doc.querySelector(selector) as HTMLAnchorElement;
      if (link && link.href) {
        // 상대 URL인 경우 절대 URL로 변환
        const url = link.href.startsWith('http') ? link.href : `${this.baseUrl}${link.href}`;
        // YES24 도서 상세 페이지인지 확인
        if (url.includes('Goods/') || url.includes('goods_id=')) {
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

    // YES24 목차 추출 시도 (여러 선택자)
    const tocSelectors = [
      '#infoset_toc .infoSetCont_wrap',     // 목차 정보 영역
      '.infoset_tab_content_text',          // 탭 내용 텍스트
      '#infoset_toc',                       // 목차 정보셋
      '.infoset_contents',                  // 정보셋 내용
      '.book_info .toc',                    // 도서 정보 목차
      '.gd_infoTbl .toc',                   // 상품 정보 테이블 목차
      '#tab03 .infoset_text'                // 목차 탭 텍스트
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

    // 목차 이미지가 있는 경우 대체 텍스트 추출 시도
    const tocImage = doc.querySelector('#infoset_toc img[alt*="목차"], #infoset_toc img[alt*="차례"]');
    if (tocImage) {
      const alt = tocImage.getAttribute('alt');
      if (alt && alt.length > 50) {
        return this.cleanTOC(alt);
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
      .replace(/^\s*table of contents\s*/i, '') // 'table of contents' 제거
      .replace(/\n\s*\n/g, '\n')               // 연속된 빈 줄을 하나로
      .replace(/^\s*\n/, '')                   // 시작 빈 줄 제거
      .replace(/\n\s*$/, '')                   // 마지막 빈 줄 제거
      .replace(/\s*\.{3,}\s*/g, ' ... ')       // 점선을 정리
      .replace(/\s*…+\s*/g, ' ... ')           // 줄임표 정리
      .replace(/더보기.*접기/g, '')             // YES24 특유의 더보기/접기 텍스트 제거
      .replace(/펼쳐보기.*닫기/g, '')           // 펼쳐보기/닫기 텍스트 제거
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 2 &&
               !trimmed.includes('더보기') &&
               !trimmed.includes('접기') &&
               !trimmed.includes('펼쳐보기') &&
               !trimmed.includes('닫기') &&
               !trimmed.includes('상품정보');
      })
      .join('\n')
      .trim();
  }
}