import { requestUrl } from 'obsidian';
import { BookInfo, NLSearchResponse, ISBNSearchResponse, ISBNBookData, SearchOptions, DetailedSearchParams } from './types';

export class NationalLibraryAPI {
  private apiKey: string;
  private readonly BASE_URL = 'https://www.nl.go.kr';
  private readonly SEARCH_API = '/NL/search/openApi/search.do';
  private readonly ISBN_API = '/seoji/SearchApi.do';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * 일반 도서 검색
   */
  async searchBooks(query: string, options: SearchOptions = {}): Promise<BookInfo[]> {
    console.log('🔍 [NL API] Starting search:', query, options);
    
    if (!this.apiKey) {
      throw new Error('API 키가 설정되지 않았습니다.');
    }

    // 1단계: 일반 검색으로 기본 정보 획득
    const basicBooks = await this.basicSearch(query, options);
    
    // 2단계: ISBN이 있는 도서들에 대해 상세 정보 (목차 포함) 획득
    if (options.enableEnhancedInfo !== false) {
      return await this.enhanceBooks(basicBooks);
    }
    
    return basicBooks;
  }

  /**
   * 상세 검색 (여러 검색 조건 조합)
   */
  async detailedSearch(params: DetailedSearchParams, options: SearchOptions = {}): Promise<BookInfo[]> {
    console.log('🔍 [NL API] Starting detailed search:', params);
    
    if (!this.apiKey) {
      throw new Error('API 키가 설정되지 않았습니다.');
    }

    const searchParams = this.buildDetailedSearchParams(params, options);
    const response = await this.makeSearchRequest(searchParams);
    const basicBooks = this.parseBasicResponse(response);
    
    if (options.enableEnhancedInfo !== false) {
      return await this.enhanceBooks(basicBooks);
    }
    
    return basicBooks;
  }

  /**
   * 목차 키워드 검색
   */
  async searchByTableOfContents(keyword: string, options: SearchOptions = {}): Promise<BookInfo[]> {
    console.log('📋 [NL API] Searching by table of contents keyword:', keyword);
    
    const detailParams: DetailedSearchParams = {
      f1: 'toc_keyword',
      v1: keyword
    };
    
    return this.detailedSearch(detailParams, options);
  }

  /**
   * 카테고리별 검색
   */
  async searchByCategory(query: string, category: string, options: SearchOptions = {}): Promise<BookInfo[]> {
    console.log('🏷️ [NL API] Searching by category:', query, category);
    
    const categoryOptions = { ...options, category };
    return this.searchBooks(query, categoryOptions);
  }

  /**
   * ISBN으로 직접 검색
   */
  async searchByISBN(isbn: string): Promise<BookInfo | null> {
    console.log('📘 [NL API] Searching by ISBN:', isbn);
    
    try {
      const isbnData = await this.searchISBNDatabase(isbn);
      if (isbnData && isbnData.length > 0) {
        return await this.convertISBNDataToBookInfo(isbnData[0]);
      }
    } catch (error) {
      console.warn('⚠️ [NL API] Failed to search by ISBN:', error);
    }
    
    return null;
  }

  private async basicSearch(query: string, options: SearchOptions): Promise<BookInfo[]> {
    const searchParams = this.buildBasicSearchParams(query, options);
    const response = await this.makeSearchRequest(searchParams);
    return this.parseBasicResponse(response);
  }

  private buildBasicSearchParams(query: string, options: SearchOptions): URLSearchParams {
    const params = new URLSearchParams({
      key: this.apiKey,
      apiType: 'json',
      pageNum: (options.pageNum || 1).toString(),
      pageSize: (options.limit || 20).toString(),
      kwd: query,
      srchTarget: options.searchTarget || 'total'
    });

    // 선택적 파라미터 추가
    if (options.category) {
      params.append('category', options.category);
    }

    if (options.systemType) {
      params.append('systemType', options.systemType);
    }

    if (options.lnbTypeName) {
      params.append('lnbTypeName', options.lnbTypeName);
    }

    if (options.sort) {
      params.append('sort', options.sort);
    }

    if (options.desc) {
      params.append('desc', options.desc);
    }

    if (options.licYn) {
      params.append('licYn', options.licYn);
    }

    if (options.govYn) {
      params.append('govYn', options.govYn);
    }

    return params;
  }

  private buildDetailedSearchParams(detailParams: DetailedSearchParams, options: SearchOptions): URLSearchParams {
    const params = new URLSearchParams({
      key: this.apiKey,
      apiType: 'json',
      pageNum: (options.pageNum || 1).toString(),
      pageSize: (options.limit || 20).toString(),
      detailSearch: 'true'
    });

    // 검색 조건들 추가
    if (detailParams.f1 && detailParams.v1) {
      params.append('f1', detailParams.f1);
      params.append('v1', detailParams.v1);
      
      if (detailParams.and1) params.append('and1', detailParams.and1);
    }

    if (detailParams.f2 && detailParams.v2) {
      params.append('f2', detailParams.f2);
      params.append('v2', detailParams.v2);
      
      if (detailParams.and2) params.append('and2', detailParams.and2);
    }

    if (detailParams.f3 && detailParams.v3) {
      params.append('f3', detailParams.f3);
      params.append('v3', detailParams.v3);
      
      if (detailParams.and3) params.append('and3', detailParams.and3);
    }

    if (detailParams.f4 && detailParams.v4) {
      params.append('f4', detailParams.f4);
      params.append('v4', detailParams.v4);
      
      if (detailParams.and4) params.append('and4', detailParams.and4);
    }

    // ISBN 검색
    if (detailParams.isbnOp && detailParams.isbnCode) {
      params.append('isbnOp', detailParams.isbnOp);
      params.append('isbnCode', detailParams.isbnCode);
    }

    // 날짜 범위 검색
    if (detailParams.sYear) params.append('sYear', detailParams.sYear);
    if (detailParams.eYear) params.append('eYear', detailParams.eYear);

    // 분류 검색
    if (detailParams.gu2 && detailParams.guCode2) {
      params.append('gu2', detailParams.gu2);
      params.append('guCode2', detailParams.guCode2);
    }

    // 기타 검색 조건들
    Object.entries(detailParams).forEach(([key, value]) => {
      if (value && !params.has(key) && key.startsWith('gu')) {
        params.append(key, value.toString());
      }
    });

    return params;
  }

  private async makeSearchRequest(searchParams: URLSearchParams): Promise<any> {
    const url = `${this.BASE_URL}${this.SEARCH_API}?${searchParams.toString()}`;
    console.log('🌐 [NL API] Request URL:', url);

    try {
      const response = await requestUrl({
        url,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Obsidian Korean Book Search Plugin/2.0',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        },
        throw: false // HTTP 에러도 처리하기 위해
      });

      // HTTP 상태 코드 확인
      if (response.status === 400) {
        throw new Error('잘못된 요청입니다. 검색 조건을 확인해주세요.');
      } else if (response.status === 401) {
        throw new Error('인증에 실패했습니다. API 키를 확인해주세요.');
      } else if (response.status === 403) {
        throw new Error('접근이 거부되었습니다. API 키 권한을 확인해주세요.');
      } else if (response.status === 429) {
        throw new Error('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
      } else if (response.status === 500) {
        throw new Error('서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      } else if (response.status !== 200) {
        throw new Error(`API 요청 실패 (HTTP ${response.status}). 관리자에게 문의해주세요.`);
      }

      return response.json;
    } catch (error) {
      if (error instanceof Error) {
        // 네트워크 오류
        if (error.message.includes('fetch')) {
          throw new Error('네트워크 연결을 확인해주세요. 인터넷 연결이 불안정하거나 서버에 접근할 수 없습니다.');
        }
        // 타임아웃 오류
        if (error.message.includes('timeout')) {
          throw new Error('요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.');
        }
      }
      throw error;
    }
  }

  private parseBasicResponse(data: NLSearchResponse): BookInfo[] {
    console.log('🔍 [NL API] Parsing response...');
    
    // API 응답 검증 및 에러 처리
    this.validateApiResponse(data, 'search');

    if (!data) {
      console.log('⚠️ [NL API] No data received');
      return [];
    }

    let results: any[] = [];
    
    if (data.result) {
      results = Array.isArray(data.result) ? data.result : [data.result];
    } else if (data.docs) {
      results = Array.isArray(data.docs) ? data.docs : [data.docs];
    } else if (data.items) {
      results = Array.isArray(data.items) ? data.items : [data.items];
    } else if (Array.isArray(data)) {
      results = data;
    }

    console.log('📊 [NL API] Found', results.length, 'raw results');

    const books = results.map((item): BookInfo => {
      return {
        title: this.cleanText(item.titleInfo || item.title_info || item.title || ''),
        author: this.cleanText(item.authorInfo || item.author_info || item.author || ''), 
        publisher: this.cleanText(item.pubInfo || item.pub_info || item.publisher || ''),
        publishDate: item.pubYearInfo || item.pub_year_info || item.publishDate || '',
        isbn: this.cleanISBN(item.isbn || item.ISBN || ''),
        detailLink: item.detailLink || item.detail_link || '',
        callNo: item.callNo || item.call_no || '',
        kdcName: item.kdcName1s || item.kdc_name_1s || '',
        controlNo: item.controlNo || item.control_no || '',
        mediaType: item.mediaName || item.media_name || '',
        typeCode: item.typeCode || item.type_code || '',
        licenseInfo: item.licText || item.lic_text || ''
      };
    }).filter(book => book.title && book.title.trim() !== '');

    console.log('✅ [NL API] Valid books after filtering:', books.length);
    return books;
  }

  /**
   * API 응답 상태 검증 및 에러 처리 강화
   */
  private validateApiResponse(data: any, apiType: 'search' | 'isbn' = 'search'): void {
    if (!data) {
      throw new Error('API 응답 데이터가 없습니다. 네트워크 상태를 확인해주세요.');
    }

    // 에러 코드가 있는 경우
    if (data.errorCode) {
      const errorMessage = apiType === 'isbn' 
        ? this.getISBNErrorMessage(data.errorCode)
        : this.getErrorMessage(data.errorCode);
      
      console.error(`❌ [NL API] ${apiType.toUpperCase()} API Error:`, {
        code: data.errorCode,
        message: errorMessage,
        response: data
      });
      
      throw new Error(errorMessage);
    }

    // 일반적인 에러 메시지가 있는 경우
    if (data.error) {
      console.error(`❌ [NL API] ${apiType.toUpperCase()} API Error:`, data.error);
      throw new Error(`API 오류: ${data.error}`);
    }

    // 예상하지 못한 응답 구조 검증
    const hasValidData = apiType === 'isbn' 
      ? (data.docs && Array.isArray(data.docs)) || data.PAGE_NO || data.TOTAL_COUNT
      : data.result || data.docs || data.items || data.total !== undefined;
    
    if (!hasValidData) {
      console.warn('⚠️ [NL API] Unexpected response structure:', data);
    }
  }

  /**
   * 자료검색 API 에러 메시지 처리 (API 문서 기준 강화)
   */
  private getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      // 자료검색 API 에러 코드 (API 문서 기준)
      '000': '시스템 오류 (SYSTEM ERROR) - 서버 내부 오류가 발생했습니다.',
      '010': 'API 키 누락 (NO KEY VALUE) - 인증키가 제공되지 않았습니다.',
      '011': '잘못된 API 키 (INVALID KEY) - 유효하지 않은 인증키입니다.',
      '012': '데이터 제한 초과 (DATA LIMIT 500) - 검색 결과는 500건까지만 조회할 수 있습니다.',
      '013': '카테고리 오류 (CATEGORY ERROR) - 카테고리 값이 올바르지 않습니다.',
      '014': '파라미터 검증 오류 (PARAMETER VALIDATION ERROR) - 입력 파라미터 값이 올바르지 않습니다.',
      '015': '필수 파라미터 누락 (REQUIRED PARAMETER MISSING) - 검색어 또는 상세검색 조건이 누락되었습니다.',
      '101': '검색 서버 오류 (SEARCH ERROR) - 검색 서버에 문제가 발생했습니다.'
    };

    const message = errorMessages[errorCode];
    return message || `알 수 없는 에러 (코드: ${errorCode}) - 관리자에게 문의해주세요.`;
  }

  /**
   * ISBN 서지정보 API 에러 메시지 처리
   */
  private getISBNErrorMessage(errorCode: string): string {
    const isbnErrorMessages: Record<string, string> = {
      '000': '시스템 오류 - ISBN 서지정보 서버에 문제가 발생했습니다.',
      '010': 'API 키 누락 - ISBN 검색을 위한 인증키가 제공되지 않았습니다.',
      '011': '잘못된 API 키 - ISBN 검색용 인증키가 유효하지 않습니다.',
      '015': '필수 파라미터 누락 - ISBN 또는 검색 조건이 누락되었습니다.'
    };

    const message = isbnErrorMessages[errorCode];
    return message || this.getErrorMessage(errorCode); // 일반 에러로 fallback
  }

  private async enhanceBooks(basicBooks: BookInfo[]): Promise<BookInfo[]> {
    console.log('🔧 [NL API] Enhancing books with detailed info...');
    
    const enhancedBooks: BookInfo[] = [];
    
    for (const book of basicBooks) {
      try {
        if (book.isbn && book.isbn.length > 0) {
          console.log('📚 [NL API] Fetching enhanced info for:', book.title);
          const enhancedBook = await this.getEnhancedBookInfo(book);
          enhancedBooks.push(enhancedBook);
        } else {
          enhancedBooks.push(book);
        }
      } catch (error) {
        console.warn('⚠️ [NL API] Failed to get enhanced info for:', book.title, error);
        enhancedBooks.push(book); // 기본 정보라도 유지
      }
    }

    console.log('✅ [NL API] Enhanced books:', enhancedBooks.length);
    return enhancedBooks;
  }

  private async getEnhancedBookInfo(basicBook: BookInfo): Promise<BookInfo> {
    if (!basicBook.isbn) {
      return basicBook;
    }

    try {
      // ISBN 서지정보 API로 상세 정보 조회
      const isbnData = await this.searchISBNDatabase(basicBook.isbn);
      
      if (isbnData && isbnData.length > 0) {
        const enhancedInfo = isbnData[0];
        
        // 목차 및 요약 정보 병렬로 가져오기
        const [tableOfContents, summary] = await Promise.all([
          enhancedInfo.BOOK_TB_CNT_URL ? this.fetchTableOfContents(enhancedInfo.BOOK_TB_CNT_URL) : Promise.resolve(''),
          this.fetchBookSummary(enhancedInfo)
        ]);

        return {
          ...basicBook,
          title: enhancedInfo.TITLE || basicBook.title,
          author: enhancedInfo.AUTHOR || basicBook.author,
          publisher: enhancedInfo.PUBLISHER || basicBook.publisher,
          publishDate: enhancedInfo.PUBLISH_PREDATE || basicBook.publishDate,
          tableOfContents,
          summary,
          imageUrl: enhancedInfo.TITLE_URL || '',
          controlNo: enhancedInfo.CONTROL_NO || basicBook.controlNo,
          kdcCode: enhancedInfo.KDC || '',
          ddcCode: enhancedInfo.DDC || '',
          pages: enhancedInfo.PAGE || '',
          bookSize: enhancedInfo.BOOK_SIZE || '',
          form: enhancedInfo.FORM || '',
          ebookYn: enhancedInfo.EBOOK_YN || '',
          cipYn: enhancedInfo.CIP_YN || ''
        };
      }
    } catch (error) {
      console.warn('⚠️ [NL API] Failed to get enhanced info:', error);
    }

    return basicBook;
  }

  private async convertISBNDataToBookInfo(isbnData: ISBNBookData): Promise<BookInfo> {
    // 목차 및 요약 정보 병렬로 가져오기
    const [tableOfContents, summary] = await Promise.all([
      isbnData.BOOK_TB_CNT_URL ? this.fetchTableOfContents(isbnData.BOOK_TB_CNT_URL) : Promise.resolve(''),
      this.fetchBookSummary(isbnData)
    ]);

    return {
      title: isbnData.TITLE || '',
      author: isbnData.AUTHOR || '',
      publisher: isbnData.PUBLISHER || '',
      publishDate: isbnData.PUBLISH_PREDATE || '',
      isbn: isbnData.EA_ISBN || '',
      tableOfContents,
      summary,
      imageUrl: isbnData.TITLE_URL || '',
      controlNo: isbnData.CONTROL_NO || '',
      kdcCode: isbnData.KDC || '',
      ddcCode: isbnData.DDC || '',
      pages: isbnData.PAGE || '',
      bookSize: isbnData.BOOK_SIZE || '',
      form: isbnData.FORM || '',
      ebookYn: isbnData.EBOOK_YN || '',
      cipYn: isbnData.CIP_YN || ''
    };
  }

  private async searchISBNDatabase(isbn: string): Promise<ISBNBookData[]> {
    const searchParams = new URLSearchParams({
      cert_key: this.apiKey,
      result_style: 'json',
      page_no: '1',
      page_size: '1',
      isbn: isbn
    });

    const url = `${this.BASE_URL}${this.ISBN_API}?${searchParams.toString()}`;
    console.log('📘 [NL API] ISBN search URL:', url);

    try {
      const response = await requestUrl({
        url,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Obsidian Korean Book Search Plugin/2.0',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        },
        throw: false
      });

      if (response.status !== 200) {
        throw new Error(`ISBN API 요청 실패 (HTTP ${response.status})`);
      }

      const data: ISBNSearchResponse = response.json;
      
      // ISBN API 전용 에러 처리
      this.validateApiResponse(data, 'isbn');

      return data.docs || [];
    } catch (error) {
      console.error('❌ [NL API] ISBN search failed:', error);
      throw error;
    }
  }

  private async fetchTableOfContents(tocUrl: string): Promise<string> {
    if (!tocUrl) {
      console.log('📋 [TOC] No URL provided');
      return '';
    }
    
    try {
      console.log('📋 [TOC] Fetching from:', tocUrl);
      
      // URL 유효성 검사
      const fullUrl = tocUrl.startsWith('http') ? tocUrl : `${this.BASE_URL}${tocUrl}`;
      
      // 타임아웃 설정으로 성능 개선
      const response = await requestUrl({
        url: fullUrl,
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'Obsidian Korean Book Search Plugin/2.0',
          'Accept-Language': 'ko-KR,ko;q=0.9'
        },
        throw: false,
        // 5초 타임아웃 설정
      });

      if (response.status === 200 && response.text) {
        console.log('📋 [TOC] HTML fetched, size:', response.text.length);
        
        // 🔍 DEBUG: '생각 망치' 책을 위한 특별 디버그 로깅
        if (tocUrl.toLowerCase().includes('thinking') || tocUrl.includes('생각') || tocUrl.includes('망치')) {
          console.log('🔍 [DEBUG] This appears to be "생각 망치" book');
          console.log('🔍 [DEBUG] Full URL:', fullUrl);
          console.log('🔍 [DEBUG] HTML Content Preview (first 2000 chars):');
          console.log(response.text.substring(0, 2000));
          
          // 목차 관련 키워드들이 HTML에 있는지 확인
          const tocKeywords = ['목차', 'toc', 'contents', 'table', '차례', '章', '편'];
          const foundKeywords = tocKeywords.filter(keyword => 
            response.text.toLowerCase().includes(keyword.toLowerCase())
          );
          console.log('🔍 [DEBUG] Found TOC keywords:', foundKeywords);
          
          // 테이블 태그들 확인
          const tableMatches = response.text.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
          console.log('🔍 [DEBUG] Number of table tags found:', tableMatches?.length || 0);
          
          if (tableMatches && tableMatches.length > 0) {
            tableMatches.forEach((table, index) => {
              console.log(`🔍 [DEBUG] Table ${index + 1} content preview (first 500 chars):`, 
                table.substring(0, 500));
            });
          }
          
          // div 태그들 확인
          const divMatches = response.text.match(/<div[^>]*class="[^"]*"[^>]*>[\s\S]*?<\/div>/gi);
          console.log('🔍 [DEBUG] Number of div tags with class found:', divMatches?.length || 0);
        }
        
        // 간소화된 목차 추출 시도
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
   * 간소화된 목차 추출 로직 - 핵심 패턴 3개 + 에러 처리
   */
  private extractTableOfContentsAdvanced(htmlContent: string): string {
    if (!htmlContent || htmlContent.length < 100) {
      console.log('📋 [TOC] HTML content too short');
      return '';
    }

    console.log('📋 [TOC] Starting simplified extraction...');
    
    // 🔍 DEBUG: '생각 망치' 관련 특별 디버그 체크
    const isThinkingHammerDebug = htmlContent.includes('생각') || htmlContent.includes('망치') || 
                                  htmlContent.toLowerCase().includes('thinking');
    
    if (isThinkingHammerDebug) {
      console.log('🔍 [DEBUG] Analyzing HTML for "생각 망치"...');
      // 전체 HTML 구조 분석
      const allTables = htmlContent.match(/<table[\s\S]*?<\/table>/gi);
      console.log('🔍 [DEBUG] All table tags found:', allTables?.length || 0);
      
      const allDivs = htmlContent.match(/<div[\s\S]*?<\/div>/gi);
      console.log('🔍 [DEBUG] All div tags found:', allDivs?.length || 0);
      
      const allUlOl = htmlContent.match(/<(?:ul|ol)[\s\S]*?<\/(?:ul|ol)>/gi);
      console.log('🔍 [DEBUG] All ul/ol tags found:', allUlOl?.length || 0);
    }
    
    // 핵심 3가지 패턴 - 성공률이 높은 순서대로
    const patterns = [
      // 1. 목차 전용 테이블 (가장 성공률 높음)
      /<table[^>]*(?:목차|toc|contents)[^>]*>([\s\S]{50,3000}?)<\/table>/gi,
      
      // 2. 목차 키워드 근처의 div/table 구조
      /(?:목차|차례)[\s\S]{0,100}<(?:div|table)[^>]*>([\s\S]{100,2000}?)<\/(?:div|table)>/gi,
      
      // 3. 순서있는 목록 (ol/ul)
      /<(?:ol|ul)[^>]*>([\s\S]{100,2000}?)<\/(?:ol|ul)>/gi
    ];

    const patternNames = [
      'Table with TOC keywords',
      'Div/Table near TOC keywords',
      'Ordered/Unordered Lists'
    ];

    for (let i = 0; i < patterns.length; i++) {
      try {
        if (isThinkingHammerDebug) {
          console.log(`🔍 [DEBUG] Trying pattern ${i + 1}: ${patternNames[i]}`);
        }
        
        const matches = htmlContent.match(patterns[i]);
        if (matches && matches.length > 0) {
          console.log(`📋 [TOC] Pattern ${i + 1} (${patternNames[i]}) found ${matches.length} matches`);
          
          if (isThinkingHammerDebug) {
            matches.forEach((match, matchIndex) => {
              console.log(`🔍 [DEBUG] Match ${matchIndex + 1} preview (first 300 chars):`, 
                match.substring(0, 300));
            });
          }
          
          for (const match of matches) {
            try {
              const content = Array.isArray(match) ? match[1] || match[0] : match;
              
              if (isThinkingHammerDebug) {
                console.log('🔍 [DEBUG] Attempting to parse content, length:', content?.length || 0);
              }
              
              const extracted = this.parseSimpleTOC(content);
              
              if (extracted && extracted.length > 50) {
                console.log(`✅ [TOC] Successfully extracted from pattern ${i + 1} (${patternNames[i]})`);
                return extracted;
              } else if (isThinkingHammerDebug) {
                console.log(`🔍 [DEBUG] Pattern ${i + 1} extraction failed - result length:`, extracted?.length || 0);
              }
            } catch (parseError) {
              console.warn(`⚠️ [TOC] Parse error for pattern ${i + 1}:`, parseError);
              continue; // 다음 매치 시도
            }
          }
        } else if (isThinkingHammerDebug) {
          console.log(`🔍 [DEBUG] Pattern ${i + 1} (${patternNames[i]}) found no matches`);
        }
      } catch (patternError) {
        console.warn(`⚠️ [TOC] Pattern ${i + 1} failed:`, patternError);
        continue; // 다음 패턴 시도
      }
    }

    if (isThinkingHammerDebug) {
      console.log('🔍 [DEBUG] All patterns exhausted. Trying fallback approaches...');
      // 더 관대한 패턴들 시도
      const fallbackPatterns = [
        /<table[\s\S]*?<\/table>/gi,  // 모든 테이블
        /<div[\s\S]*?목차[\s\S]*?<\/div>/gi,  // 목차가 포함된 div
        /<ul[\s\S]*?<\/ul>/gi,  // 모든 unordered list
        /<ol[\s\S]*?<\/ol>/gi   // 모든 ordered list
      ];
      
      const fallbackNames = ['Any Table', 'Div with 목차', 'Any UL', 'Any OL'];
      
      for (let i = 0; i < fallbackPatterns.length; i++) {
        const fallbackMatches = htmlContent.match(fallbackPatterns[i]);
        console.log(`🔍 [DEBUG] Fallback pattern ${i + 1} (${fallbackNames[i]}) found ${fallbackMatches?.length || 0} matches`);
      }
    }

    console.log('⚠️ [TOC] No valid table of contents found');
    return '';
  }

  // hasChapterLikeContent 함수 제거 - 더 이상 사용되지 않음

  /**
   * 간소화된 목차 파싱 - 에러 처리 강화
   */
  private parseSimpleTOC(htmlContent: string): string {
    if (!htmlContent || htmlContent.length < 20) {
      console.log('📋 [TOC] Content too short for parsing');
      return '';
    }

    try {
      console.log('📋 [TOC] Parsing content, length:', htmlContent.length);
      
      // 안전한 HTML 정리 - 단계별 처리
      let cleanText = htmlContent;
      
      // 1. 스크립트와 스타일 제거
      cleanText = cleanText.replace(/<script[\s\S]*?<\/script>/gi, '');
      cleanText = cleanText.replace(/<style[\s\S]*?<\/style>/gi, '');
      
      // 2. HTML 태그를 줄바꿈으로 치환
      cleanText = cleanText.replace(/<[^>]*>/g, '\n');
      
      // 3. HTML 엔티티 정리
      cleanText = cleanText.replace(/&nbsp;/g, ' ')
                           .replace(/&[^;]+;/g, ' ')
                           .replace(/\s+/g, ' ')
                           .trim();

      if (!cleanText || cleanText.length < 10) {
        console.log('📋 [TOC] No meaningful text after cleanup');
        return '';
      }

      // 라인별로 분리하고 유효한 목차 항목만 필터링
      const lines = cleanText
        .split(/[\n\r]+/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .filter(line => this.isSimpleValidTOC(line))
        .slice(0, 20); // 성능을 위해 최대 20개 항목만

      if (lines.length >= 2) {
        const formatted = lines.map(line => `- ${line}`).join('\n');
        console.log(`📋 [TOC] Successfully parsed ${lines.length} items`);
        return formatted;
      } else {
        console.log('📋 [TOC] Not enough valid items found:', lines.length);
        return '';
      }
    } catch (error) {
      console.error('❌ [TOC] Parsing error:', error);
      return '';
    }
  }

  /**
   * 간단한 목차 유효성 검증 - 복잡한 로직 제거
   */
  private isSimpleValidTOC(item: string): boolean {
    if (!item || item.length < 3 || item.length > 150) return false;
    
    // 목차 항목 패턴 (핵심 패턴 5개만)
    const validPatterns = [
      /^(?:제?\s*\d+[\s]*[장편부권회절화탄])/,      // 제1장, 1장 등
      /^\d+[\.\)\-]\s/,                           // 1. 1) 1-
      /^[가나다라마바사아자차카타파하][\.\)]\s/,    // 가. 나) 등
      /^Chapter\s+\d+/i,                          // Chapter 1
      /^부록|^참고문헌|^찾아보기/                   // 부록, 참고문헌 등
    ];

    const hasPattern = validPatterns.some(pattern => pattern.test(item));
    
    // 제외할 내용 (간소화)
    const invalidWords = ['copyright', '저작권', 'page', '페이지', 'click', '클릭', '목차', '차례', 'isbn'];
    const hasInvalidWord = invalidWords.some(word => item.toLowerCase().includes(word));
    
    const hasKoreanOrEnglish = /[가-힣]{2,}|[a-zA-Z]{3,}/.test(item);
    
    return hasPattern && !hasInvalidWord && hasKoreanOrEnglish;
  }

  // 기존 복잡한 함수들 제거 - parseSimpleTOC와 isSimpleValidTOC만 사용

  private async fetchBookSummary(bookData: ISBNBookData | { BOOK_INTRODUCTION_URL?: string; BOOK_SUMMARY_URL?: string; }): Promise<string> {
    const urls = [
      bookData.BOOK_INTRODUCTION_URL,
      bookData.BOOK_SUMMARY_URL
    ].filter(url => url && url.trim() !== '');

    for (const url of urls) {
      try {
        console.log('📝 [NL API] Fetching summary from:', url);
        
        const fullUrl = url!.startsWith('http') ? url! : `${this.BASE_URL}${url}`;
        
        const response = await requestUrl({
          url: fullUrl,
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml',
            'User-Agent': 'Obsidian Korean Book Search Plugin/2.0',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
          },
          throw: false
        });

        if (response.status === 200) {
          const htmlContent = response.text;
          const summary = this.extractSummaryAdvanced(htmlContent);
          
          if (summary && summary.length > 30) {
            console.log('✅ [NL API] Summary extracted, length:', summary.length);
            return summary;
          }
        }
      } catch (error) {
        console.warn('⚠️ [NL API] Failed to fetch summary from:', url, error);
      }
    }
    
    return '';
  }

  private extractSummaryAdvanced(htmlContent: string): string {
    const summaryPatterns = [
      // 책 소개 섹션
      /<div[^>]*(?:class|id)="[^"]*(?:book-intro|bookintro|introduction|책소개|도서소개)[^"]*"[^>]*>([\s\S]{100,3000}?)<\/div>/gi,
      
      // 요약 섹션
      /<div[^>]*(?:class|id)="[^"]*(?:summary|요약|책요약)[^"]*"[^>]*>([\s\S]{100,3000}?)<\/div>/gi,
      
      // 설명 섹션
      /<div[^>]*(?:class|id)="[^"]*(?:description|desc|설명)[^"]*"[^>]*>([\s\S]{100,3000}?)<\/div>/gi,
      
      // 본문 내용
      /<div[^>]*(?:class|id)="[^"]*(?:content|contents|main)[^"]*"[^>]*>([\s\S]{100,3000}?)<\/div>/gi,
      
      // 일반적인 paragraph 패턴
      /<p[^>]*>([\s\S]{100,1500}?)<\/p>/gi
    ];
    
    for (const pattern of summaryPatterns) {
      const matches = htmlContent.match(pattern);
      if (matches && matches.length > 0) {
        for (const match of matches) {
          const cleaned = this.cleanText(match);
          if (this.isValidSummary(cleaned)) {
            return cleaned;
          }
        }
      }
    }
    
    return '';
  }

  private isValidSummary(text: string): boolean {
    if (!text || text.length < 50 || text.length > 3000) return false;
    
    // 불필요한 내용 제외
    const invalidPatterns = [
      /copyright|저작권|©/i,
      /navigation|menu|메뉴/i,
      /click|클릭|링크/i,
      /^\s*[\d\s\-\.]+\s*$/,
      /^[\s\W]+$/
    ];
    
    const hasInvalidPattern = invalidPatterns.some(pattern => pattern.test(text));
    
    // 의미있는 내용인지 확인
    const meaningfulWords = text.match(/[가-힣]{2,}|[a-zA-Z]{3,}/g);
    const hasMeaningfulContent = meaningfulWords && meaningfulWords.length >= 5;
    
    return !hasInvalidPattern && hasMeaningfulContent;
  }

  /**
   * 텍스트 정리 함수 강화
   */
  private cleanText(text: string): string {
    if (!text) return '';
    
    return text.toString()
      // 스크립트와 스타일 태그 제거
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // HTML 태그 제거
      .replace(/<[^>]*>/g, ' ')
      // HTML 엔티티 변환
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .replace(/&#x([a-fA-F0-9]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&[^;]+;/g, ' ')
      // 공백 정리
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  private cleanISBN(isbn: string): string {
    if (!isbn) return '';
    // ISBN-10, ISBN-13 형식 모두 지원하되 하이픈 제거
    return isbn.replace(/[^\dX]/gi, '').toUpperCase();
  }
}