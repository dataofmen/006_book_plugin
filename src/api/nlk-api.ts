import { requestUrl, RequestUrlParam } from 'obsidian';
import { Book, ISBNSearchResponse, NLKSearchResponse, SearchParams } from './types';

export class NationalLibraryAPI {
  private readonly BASE_URL = 'https://www.nl.go.kr';
  private readonly SEARCH_API = '/NL/search/openApi/search.do';
  private readonly ISBN_API = '/seoji/SearchApi.do';
  
  constructor(private apiKey: string) {}

  /**
   * 가장 간단한 검색 - 디버깅용
   */
  async searchBooks(params: SearchParams): Promise<Book[]> {
    console.log('🔍 [API] Starting search with params:', params);
    console.log('🔑 [API] API Key:', this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'MISSING');
    
    // 가장 기본적인 파라미터만 사용
    const searchParams = new URLSearchParams();
    searchParams.set('key', this.apiKey);
    searchParams.set('apiType', 'json');
    searchParams.set('pageNum', '1');
    searchParams.set('pageSize', '5');
    searchParams.set('kwd', params.query || '토지'); // 기본값으로 '토지' 사용
    
    const url = `${this.BASE_URL}${this.SEARCH_API}?${searchParams.toString()}`;
    console.log('🌐 [API] Request URL:', url);
    
    try {
      console.log('📡 [API] Making request...');
      
      const response = await requestUrl({
        url,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*'
        }
      });

      console.log('✅ [API] Response received:', {
        status: response.status,
        headers: response.headers,
        hasJson: !!response.json,
        hasText: !!response.text,
        textLength: response.text?.length
      });
      
      if (response.status !== 200) {
        console.error('❌ [API] HTTP Error:', response.status);
        throw new Error(`HTTP ${response.status}: API 요청이 실패했습니다`);
      }

      // 응답 데이터 확인
      let responseData = null;
      
      if (response.json) {
        responseData = response.json;
        console.log('📄 [API] JSON Response:', responseData);
      } else if (response.text) {
        console.log('📄 [API] Text Response (first 500 chars):', response.text.substring(0, 500));
        try {
          responseData = JSON.parse(response.text);
          console.log('📄 [API] Parsed JSON:', responseData);
        } catch (parseError) {
          console.error('❌ [API] JSON Parse Error:', parseError);
          console.log('📄 [API] Raw text:', response.text);
          throw new Error('응답을 JSON으로 파싱할 수 없습니다');
        }
      } else {
        console.error('❌ [API] No response data');
        throw new Error('API로부터 응답 데이터를 받지 못했습니다');
      }

      // 에러 응답 체크
      if (responseData.error || responseData.errorCode) {
        console.error('❌ [API] API Error Response:', responseData);
        throw new Error(`API 에러: ${responseData.error || responseData.errorCode}`);
      }

      // 결과 파싱
      const books = this.parseResponse(responseData);
      console.log(`✅ [API] Parsed ${books.length} books:`, books);
      
      // 임시로 목차 추출 기능 비활성화 - 기본 검색만 작동하도록
      console.log('ℹ️ [API] TOC enhancement disabled for debugging');
      return books;
      
    } catch (error) {
      console.error('❌ [API] Search failed:', error);
      if (error.message.includes('net::ERR_')) {
        throw new Error('네트워크 연결 오류입니다. 인터넷 연결을 확인해주세요.');
      } else if (error.message.includes('CORS')) {
        throw new Error('CORS 오류입니다. API 설정을 확인해주세요.');
      }
      throw error;
    }
  }

  /**
   * 응답 파싱 - 디버깅 강화 버전
   */
  private parseResponse(data: any): Book[] {
    console.log('🔍 [Parse] Starting to parse response');
    
    if (!data) {
      console.log('❌ [Parse] No data');
      return [];
    }

    // 응답 구조 분석
    let resultArray: any[] = [];
    
    // 국립중앙도서관 API의 실제 응답 구조 확인
    if (data.result && Array.isArray(data.result)) {
      resultArray = data.result;
      console.log(`✅ [Parse] Found ${resultArray.length} items in data.result`);
    } else if (data.docs && Array.isArray(data.docs)) {
      resultArray = data.docs;
      console.log(`✅ [Parse] Found ${resultArray.length} items in data.docs`);
    } else if (Array.isArray(data)) {
      resultArray = data;
      console.log(`✅ [Parse] Data is array: ${resultArray.length} items`);
    } else {
      console.log('❌ [Parse] No valid result structure found');
      return [];
    }

    if (resultArray.length === 0) {
      console.log('❌ [Parse] Result array is empty');
      return [];
    }

    // 각 결과를 Book 객체로 변환
    const books: Book[] = [];
    
    resultArray.forEach((item, index) => {
      // 실제 API 필드명으로 수정
      const title = this.extractField(item, [
        'titleInfo', 'title_info', 'title', 'TITLE', 'bookTitle', 'name'
      ]);
      const author = this.extractField(item, [
        'authorInfo', 'author_info', 'author', 'AUTHOR', 'writer', 'bookAuthor'
      ]);
      const publisher = this.extractField(item, [
        'pubInfo', 'pub_info', 'publisher', 'PUBLISHER', 'publisherName'
      ]);
      const isbn = this.extractField(item, [
        'isbn', 'ISBN', 'EA_ISBN', 'isbnCode'
      ]);

      // 최소한 제목이 있는 경우만 추가
      if (title && title.trim() !== '') {
        const book: Book = {
          title: this.cleanText(title),
          author: this.cleanText(author),
          publisher: this.cleanText(publisher),
          publishDate: this.cleanText(this.extractField(item, ['pubYearInfo', 'pub_year_info', 'publishDate', 'PUBLISH_PREDATE'])),
          isbn: this.cleanText(isbn),
          callNumber: this.cleanText(this.extractField(item, ['callNo', 'call_no', 'callNumber'])),
          detailLink: this.cleanText(this.extractField(item, ['detailLink', 'detail_link'])),
          subject: this.cleanText(this.extractField(item, ['typeName', 'type_name', 'subject', 'SUBJECT'])),
          ebook: this.extractField(item, ['mediaName']) === '전자책' || 
                 this.extractField(item, ['media_name']) === '전자책' ||
                 this.extractField(item, ['EBOOK_YN']) === 'Y',
          coverImage: this.cleanText(this.extractField(item, ['imageUrl', 'title_url', 'TITLE_URL', 'coverImage'])),
          tableOfContents: '' // 기본값, 후에 ISBN으로 상세 정보 획득시 채워짐
        };
        
        books.push(book);
      } else {
        console.log(`❌ [Parse] Item ${index} has no title, skipping`);
      }
    });

    console.log(`✅ [Parse] Successfully parsed ${books.length}/${resultArray.length} books`);
    return books;
  }

  /**
   * 여러 필드명 중에서 값이 있는 첫 번째 필드 반환
   */
  private extractField(item: any, fieldNames: string[]): string {
    for (const fieldName of fieldNames) {
      const value = item[fieldName];
      if (value && value.toString().trim() !== '') {
        return value.toString();
      }
    }
    return '';
  }

  /**
   * ISBN 검색 - 목차 정보 포함
   */
  async searchByISBN(isbn: string): Promise<Book | null> {
    console.log(`🔍 [ISBN] Searching for ISBN: ${isbn}`);
    
    try {
      // ISBN 서지정보 API로 상세 정보 검색
      const isbnData = await this.fetchISBNData(isbn);
      
      if (isbnData && isbnData.length > 0) {
        const bookData = isbnData[0];
        
        // 목차 정보 가져오기
        const tableOfContents = bookData.BOOK_TB_CNT_URL 
          ? await this.fetchTableOfContents(bookData.BOOK_TB_CNT_URL)
          : '';
        
        const book: Book = {
          title: this.cleanText(bookData.TITLE),
          author: this.cleanText(bookData.AUTHOR),
          publisher: this.cleanText(bookData.PUBLISHER),
          publishDate: this.cleanText(bookData.PUBLISH_PREDATE),
          isbn: this.cleanText(bookData.EA_ISBN),
          price: bookData.PRE_PRICE,
          pages: bookData.PAGE,
          size: bookData.BOOK_SIZE,
          kdc: bookData.KDC,
          ddc: bookData.DDC,
          subject: this.cleanText(bookData.SUBJECT),
          tableOfContents,
          coverImage: this.cleanText(bookData.TITLE_URL),
          ebook: bookData.EBOOK_YN === 'Y',
          callNumber: '',
          detailLink: ''
        };
        
        console.log('✅ [ISBN] Found book with TOC:', book);
        return book;
      } else {
        console.log('❌ [ISBN] No matching book found');
        return null;
      }
    } catch (error) {
      console.error('❌ [ISBN] Search failed:', error);
      return null;
    }
  }

  /**
   * ISBN 서지정보 API 호출
   */
  private async fetchISBNData(isbn: string): Promise<any[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('key', this.apiKey);
    searchParams.set('target', 'isbn');
    searchParams.set('isbn', isbn.replace(/[-\s]/g, ''));
    
    const url = `${this.BASE_URL}${this.ISBN_API}?${searchParams.toString()}`;
    
    const response = await requestUrl({
      url,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    
    if (response.status === 200) {
      const data = response.json || JSON.parse(response.text);
      return data.docs || [];
    }
    
    return [];
  }

  /**
   * 텍스트 정리
   */
  private cleanText(text: string): string {
    if (!text || text === 'undefined' || text === 'null') {
      return '';
    }
    
    // HTML 태그 제거
    text = text.replace(/<[^>]*>/g, '');
    
    // HTML 엔티티 변환
    text = text.replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&#039;/g, "'")
               .replace(/&nbsp;/g, ' ');
    
    // 공백 정리
    text = text.trim().replace(/\s+/g, ' ');
    
    return text;
  }

  /**
   * 목차 페이지에서 목차 정보 추출
   */
  private async fetchTableOfContents(tocUrl: string): Promise<string> {
    if (!tocUrl) return '';
    
    console.log('📋 [TOC] Fetching table of contents from:', tocUrl);
    
    try {
      const response = await requestUrl({
        url: tocUrl,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      
      if (response.status === 200 && response.text) {
        const tocText = this.extractTableOfContentsAdvanced(response.text);
        
        if (tocText && tocText.length > 10) {
          console.log('✅ [TOC] Successfully extracted, length:', tocText.length);
          return tocText;
        } else {
          console.log('⚠️ [TOC] No valid content found after extraction');
          return this.getFallbackMessage('목차 정보 추출 실패');
        }
      } else {
        console.warn(`⚠️ [TOC] HTTP ${response.status} - fetch failed`);
        return this.getFallbackMessage('목차 페이지 접근 불가');
      }
    } catch (error) {
      console.error('❌ [TOC] Error during fetch:', error);
      return this.getFallbackMessage('목차 추출 중 오류 발생');
    }
  }

  /**
   * 목차 추출 실패 시 사용할 폴백 메시지
   */
  private getFallbackMessage(reason: string): string {
    return `⚠️ ${reason}\n\n목차 정보는 국립중앙도서관 사이트에서 직접 확인하세요.`;
  }

  /**
   * HTML에서 목차 정보 추출 (간소화된 버전)
   */
  private extractTableOfContentsAdvanced(htmlContent: string): string {
    if (!htmlContent || htmlContent.length < 100) {
      console.log('📋 [TOC] HTML content too short');
      return '';
    }

    console.log('📋 [TOC] Starting simplified extraction...');
    
    // 핵심 목차 추출 패턴 3개
    const primaryPatterns = [
      // 1. 목차 전용 테이블 (가장 성공률 높음)
      /<table[^>]*(?:목차|toc|contents)[^>]*>([\s\S]{50,3000}?)<\/table>/gi,
      
      // 2. 목차 키워드 근처의 div/table 구조
      /(?:목차|차례)[\s\S]{0,100}<(?:div|table)[^>]*>([\s\S]{100,2000}?)<\/(?:div|table)>/gi,
      
      // 3. 리스트 형태의 목차
      /<(?:ul|ol)[^>]*class="[^"]*(?:toc|contents|목차)[^"]*"[^>]*>([\s\S]{50,2000}?)<\/(?:ul|ol)>/gi
    ];

    const patternNames = ['목차 테이블', '목차 키워드 구조', '목차 리스트'];
    
    for (let i = 0; i < primaryPatterns.length; i++) {
      const pattern = primaryPatterns[i];
      const matches = [...htmlContent.matchAll(pattern)];
      
      console.log(`📋 [TOC] Pattern ${i + 1} (${patternNames[i]}): ${matches.length} matches`);
      
      for (const match of matches) {
        if (match[1]) {
          const parsedToc = this.parseTableOfContentsText(match[1]);
          if (this.isValidTableOfContents(parsedToc)) {
            console.log(`✅ [TOC] Valid TOC found with pattern: ${patternNames[i]}`);
            return parsedToc;
          }
        }
      }
    }

    // 폴백 패턴들
    const fallbackPatterns = [
      /<table[^>]*>([\s\S]{200,1500}?)<\/table>/gi,  // Any meaningful table
      /<div[\s\S]*?목차[\s\S]*?<\/div>/gi,  // 목차가 포함된 div
      /<ul[^>]*>([\s\S]{100,1500}?)<\/ul>/gi,  // Any UL
      /<ol[^>]*>([\s\S]{100,1500}?)<\/ol>/gi   // Any OL
    ];
    
    const fallbackNames = ['Any Table', 'Div with 목차', 'Any UL', 'Any OL'];
    
    for (let i = 0; i < fallbackPatterns.length; i++) {
      const pattern = fallbackPatterns[i];
      const matches = [...htmlContent.matchAll(pattern)];
      
      for (const match of matches) {
        if (match[1]) {
          const parsedToc = this.parseTableOfContentsText(match[1]);
          if (this.isValidTableOfContents(parsedToc)) {
            console.log(`✅ [TOC] Valid TOC found with fallback: ${fallbackNames[i]}`);
            return parsedToc;
          }
        }
      }
    }

    console.log('⚠️ [TOC] No valid table of contents found');
    return '';
  }

  /**
   * HTML 텍스트를 목차 형태로 파싱
   */
  private parseTableOfContentsText(htmlText: string): string {
    try {
      // HTML 태그 제거하고 텍스트만 추출
      let text = htmlText
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // 스크립트 제거
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')   // 스타일 제거
        .replace(/<br\s*\/?>/gi, '\n')                      // br 태그를 줄바꿈으로
        .replace(/<\/(?:tr|li|p|div)>/gi, '\n')            // 블록 요소 끝을 줄바꿈으로
        .replace(/<[^>]*>/g, ' ')                          // 나머지 HTML 태그 제거
        .replace(/&nbsp;/g, ' ')                           // nbsp를 공백으로
        .replace(/&[a-z]+;/gi, '')                         // HTML 엔티티 제거
        .replace(/\s+/g, ' ')                              // 연속된 공백을 하나로
        .trim();
      
      if (!text) return '';
      
      // 라인별로 분리하고 유효한 목차 항목만 필터링
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => {
          if (line.length < 2 || line.length > 200) return false;
          
          // 목차 항목 패턴 체크
          const tocPatterns = [
            /^\d+[.\s]/,                    // 1. 또는 1 
            /^[가-힣]\s*[.\s]/,             // 가. 또는 가 
            /^[IVX]+[.\s]/i,                // I. II. III.
            /^제\s*\d+[장절편부]/,          // 제1장, 제2절
            /^[\w가-힣]{2,}[\s]*[:：]/      // 제목: 형태
          ];
          
          return tocPatterns.some(pattern => pattern.test(line));
        })
        .slice(0, 30); // 최대 30개 항목
      
      if (lines.length < 2) return '';
      
      return lines.join('\n');
      
    } catch (error) {
      console.error('❌ [TOC] Error parsing TOC text:', error);
      return '';
    }
  }

  /**
   * 목차 유효성 검증
   */
  private isValidTableOfContents(text: string): boolean {
    if (!text || text.length < 20 || text.length > 5000) return false;
    
    // 목차 항목 패턴 (핵심 패턴 5개만)
    const tocPatterns = [
      /\d+[.\s]/g,                    // 숫자 목차
      /제\s*\d+[장절편부]/g,          // 제1장 형태
      /[가-힣]\s*[.\s]/g,             // 가. 나. 형태
      /[IVX]+[.\s]/gi,                // 로마숫자
      /[\w가-힣]{3,}\s*[:：]/g       // 제목: 형태
    ];
    
    const matchCount = tocPatterns.reduce((sum, pattern) => {
      return sum + (text.match(pattern) || []).length;
    }, 0);
    
    // 부적절한 단어들 체크
    const invalidWords = ['copyright', '저작권', 'page', '페이지', 'click', '클릭', '목차', '차례', 'isbn'];
    const hasInvalidWords = invalidWords.some(word => 
      text.toLowerCase().includes(word.toLowerCase())
    );
    
    return matchCount >= 3 && !hasInvalidWords;
  }

  /**
   * API 키 확인 - 간단한 버전
   */
  async validateApiKey(): Promise<boolean> {
    console.log('🔑 [Validate] Checking API key...');
    
    try {
      const result = await this.searchBooks({ query: '테스트' });
      const isValid = result.length >= 0; // 에러가 없으면 유효
      console.log(`🔑 [Validate] API key is ${isValid ? 'valid' : 'invalid'}`);
      return isValid;
    } catch (error) {
      console.error('🔑 [Validate] API key validation failed:', error);
      return false;
    }
  }
}
