import { SessionManager } from './session-manager';
import { Book } from './types';

/**
 * 목차 추출 결과 인터페이스
 */
export interface TOCFetchResult {
  success: boolean;
  content?: string;
  error?: string;
  method: 'session-book-tb-cnt-url' | 'session-detail-page' | 'session-txt-download' | 'fallback' | 'advanced-json-ld' | 'advanced-metadata' | 'advanced-direct-api' | 'advanced-search-results' | 'advanced-multiple-urls' | 'advanced-enhanced-html' | 'all-failed';
  responseTime?: number;
}

/**
 * 목차 추출 전용 서비스 클래스
 */
export class TableOfContentsService {
  private debugMode = true;
  
  constructor(
    private sessionManager: SessionManager,
    private apiKey: string
  ) {}

  /**
   * 디버깅 로그 출력
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    if (!this.debugMode) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `📚 [TOCService-${level.toUpperCase()}] ${timestamp}`;
    
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
   * 메인 목차 추출 메서드
   */
  async fetchTableOfContents(book: Book): Promise<TOCFetchResult> {
    this.log('info', `======= TOC 추출 시작: ${book.title} =======`);
    
    if (!book.controlNo && !book.isbn) {
      return {
        success: false,
        error: 'CONTROL_NO 또는 ISBN 정보가 필요합니다.',
        method: 'fallback'
      };
    }

    // 방법 1: BOOK_TB_CNT_URL 사용 (세션 기반)
    if (book.controlNo) {
      const result1 = await this.tryBookTbCntUrlWithSession(book);
      if (result1.success) {
        this.log('info', `목차 추출 성공: ${result1.method}`);
        return result1;
      }
    }

    // 방법 2: 상세 페이지 HTML 파싱 (세션 기반)
    if (book.controlNo) {
      const result2 = await this.tryDetailPageWithSession(book);
      if (result2.success) {
        this.log('info', `목차 추출 성공: ${result2.method}`);
        return result2;
      }
    }

    // 방법 3: TXT 다운로드 API (세션 기반)
    if (book.controlNo) {
      const result3 = await this.tryTxtDownloadWithSession(book);
      if (result3.success) {
        this.log('info', `목차 추출 성공: ${result3.method}`);
        return result3;
      }
    }

    // 모든 방법 실패
    this.log('error', '모든 목차 추출 방법이 실패했습니다.');
    return {
      success: false,
      error: '목차 정보를 찾을 수 없습니다. 국립중앙도서관 사이트에서 직접 확인해 주세요.',
      method: 'fallback'
    };
  }

  /**
   * 방법 1: BOOK_TB_CNT_URL 사용 (세션 기반)
   */
  private async tryBookTbCntUrlWithSession(book: Book): Promise<TOCFetchResult> {
    this.log('info', '방법 1: BOOK_TB_CNT_URL 사용 (세션 기반)');
    const startTime = Date.now();
    
    try {
      // 먼저 ISBN 데이터를 다시 가져와서 BOOK_TB_CNT_URL 확인
      const isbnData = await this.getISBNDataWithSession(book);
      if (!isbnData || !isbnData.BOOK_TB_CNT_URL) {
        return {
          success: false,
          error: 'BOOK_TB_CNT_URL을 찾을 수 없습니다.',
          method: 'session-book-tb-cnt-url',
          responseTime: Date.now() - startTime
        };
      }

      this.log('info', `BOOK_TB_CNT_URL 발견: ${isbnData.BOOK_TB_CNT_URL}`);
      
      // 상세 페이지를 먼저 방문하여 적절한 referrer 설정
      const detailPageUrl = await this.sessionManager.navigateToBookDetail(book.controlNo!, book.title);
      
      // BOOK_TB_CNT_URL에 세션과 함께 요청
      const tocResponse = await this.sessionManager.makeAuthenticatedRequest(
        isbnData.BOOK_TB_CNT_URL,
        detailPageUrl
      );
      
      if (tocResponse && tocResponse.text) {
        const tocContent = this.parseTableOfContentsText(tocResponse.text);
        if (this.isValidTableOfContents(tocContent)) {
          return {
            success: true,
            content: tocContent,
            method: 'session-book-tb-cnt-url',
            responseTime: Date.now() - startTime
          };
        }
      }
      
      return {
        success: false,
        error: 'BOOK_TB_CNT_URL에서 유효한 목차를 찾을 수 없습니다.',
        method: 'session-book-tb-cnt-url',
        responseTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.log('error', 'BOOK_TB_CNT_URL 방법 실패', error);
      return {
        success: false,
        error: `BOOK_TB_CNT_URL 접근 오류: ${error.message}`,
        method: 'session-book-tb-cnt-url',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * 방법 2: 상세 페이지 HTML 파싱 (세션 기반)
   */
  private async tryDetailPageWithSession(book: Book): Promise<TOCFetchResult> {
    this.log('info', '방법 2: 상세 페이지 HTML 파싱 (세션 기반)');
    const startTime = Date.now();
    
    try {
      // 상세 페이지 네비게이션 및 접근
      const detailPageUrl = await this.sessionManager.navigateToBookDetail(book.controlNo!, book.title);
      
      // 상세 페이지 HTML 콘텐츠 가져오기
      const detailResponse = await this.sessionManager.makeAuthenticatedRequest(detailPageUrl);

      if (detailResponse && detailResponse.text) {
        const tocContent = this.extractTOCFromDetailPageHTML(detailResponse.text, book.controlNo!, book.title);
        if (this.isValidTableOfContents(tocContent)) {
          return {
            success: true,
            content: tocContent,
            method: 'session-detail-page',
            responseTime: Date.now() - startTime
          };
        }
      }
      
      return {
        success: false,
        error: '상세 페이지에서 유효한 목차를 찾을 수 없습니다.',
        method: 'session-detail-page',
        responseTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.log('error', '상세 페이지 방법 실패', error);
      return {
        success: false,
        error: `상세 페이지 접근 오류: ${error.message}`,
        method: 'session-detail-page',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * 방법 3: TXT 다운로드 API (세션 기반)
   */
  private async tryTxtDownloadWithSession(book: Book): Promise<TOCFetchResult> {
    this.log('info', '방법 3: TXT 다운로드 API (세션 기반)');
    const startTime = Date.now();
    
    try {
      // 상세 페이지 먼저 방문
      const detailPageUrl = await this.sessionManager.navigateToBookDetail(book.controlNo!, book.title);
      
      // 주요 TXT 다운로드 URL 패턴들
      const txtDownloadUrls = [
        `https://www.nl.go.kr/NL/contents/contentsFileDownload.do?viewKey=${book.controlNo}&fileType=txt`,
        `https://www.nl.go.kr/seoji/contents/ContentsTxtDownload.do?CN=${book.controlNo}`,
        `https://www.nl.go.kr/NL/search/openApi/tocText.do?key=${this.apiKey}&controlNo=${book.controlNo}`
      ];
      
      for (const txtUrl of txtDownloadUrls) {
        try {
          this.log('info', `TXT URL 시도: ${txtUrl}`);
          const txtResponse = await this.sessionManager.makeAuthenticatedRequest(txtUrl, detailPageUrl);
          
          if (txtResponse && txtResponse.text) {
            const tocContent = this.extractTOCFromTxtContent(txtResponse.text);
            if (this.isValidTableOfContents(tocContent)) {
              return {
                success: true,
                content: tocContent,
                method: 'session-txt-download',
                responseTime: Date.now() - startTime
              };
            }
          }
        } catch (urlError) {
          this.log('warn', `TXT URL 실패: ${txtUrl}`, urlError);
        }
      }
      
      return {
        success: false,
        error: '모든 TXT 다운로드 URL에서 유효한 목차를 찾을 수 없습니다.',
        method: 'session-txt-download',
        responseTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.log('error', 'TXT 다운로드 방법 실패', error);
      return {
        success: false,
        error: `TXT 다운로드 오류: ${error.message}`,
        method: 'session-txt-download',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * ISBN 데이터를 세션과 함께 가져오기
   */
  private async getISBNDataWithSession(book: Book): Promise<any> {
    if (!book.isbn) return null;
    
    try {
      const cleanIsbn = book.isbn.replace(/[-\s]/g, '');
      const isbnUrl = `https://www.nl.go.kr/seoji/SearchApi.do?key=${this.apiKey}&target=isbn&isbn=${cleanIsbn}`;
      
      const response = await this.sessionManager.makeAuthenticatedRequest(isbnUrl);
      
      if (response && response.text) {
        const data = JSON.parse(response.text);
        const docs = data.docs || [];
        return docs.length > 0 ? docs[0] : null;
      }
    } catch (error) {
      this.log('error', 'ISBN 데이터 가져오기 실패', error);
    }
    
    return null;
  }

  /**
   * HTML에서 목차 추출 (개선된 알고리즘)
   */
  private extractTOCFromDetailPageHTML(htmlContent: string, controlNo: string, bookTitle: string): string {
    this.log('info', `HTML 콘텐츠에서 목차 추출 시도 (${htmlContent.length} chars)`);
    this.log('info', `대상 도서: ${bookTitle} (${controlNo})`);

    // 1단계: 잘못된 콘텐츠 필터링 (특정 문제 해결)
    const invalidPatterns = [
      /^\s*\d+\s*\|\s*한강\s*$/,  // "1 | 한강" 같은 잘못된 콘텐츠
      /^\s*\d+\s*\|\s*[가-희]{1,5}\s*$/,  // 단순한 "숫자 | 한글" 패턴
      /^[\d\s\|\-=]+$/,  // 숫자와 기호만 있는 경우
      /검색결과|search result|목록$|list$/i,  // 검색 결과 제목
      /인기검색어|검색질의어|검색건수/i,  // 인기검색어 섹션
      /^\s*편안함의\s*습격\s*$/i,  // 특정 인기검색어들
      /^\s*경험의\s*멸종\s*$/i,
      /^\s*혼모노\s*$/i,
      /^\s*채식주의자\s*$/i,
      /^\s*궤도\s*$/i,
      /^\s*가공범\s*$/i,
      /베스트셀러|best.*seller/i,  // 베스트셀러 목록
      /신간도서|new.*book/i,  // 신간 도서 목록
      /추천도서|recommend/i  // 추천 도서
    ];

    // 2단계: 도서 고유 식별자를 이용한 정확한 영역 추출
    let targetContent = '';
    
    // controlNo를 포함한 특정 도서 데이터 영역 찾기
    const bookDataPatterns = [
      // JavaScript 변수나 JSON 데이터에서 해당 도서 정보 찾기
      new RegExp(`["']?${controlNo}["']?[\\s\\S]{200,2000}?`, 'gi'),
      // viewKey 파라미터와 함께 있는 영역
      new RegExp(`viewKey.*?${controlNo}[\\s\\S]{100,1500}?`, 'gi'),
      // 테이블 행에서 controlNo와 함께 있는 목차 정보
      new RegExp(`<tr[^>]*>[\\s\\S]*?${controlNo}[\\s\\S]*?목차[\\s\\S]*?</tr>`, 'gi'),
      // 도서 제목 주변의 상세 정보
      new RegExp(`${bookTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{100,1000}?`, 'gi')
    ];

    for (const pattern of bookDataPatterns) {
      const matches = [...htmlContent.matchAll(pattern)];
      if (matches.length > 0) {
        targetContent = matches[0][0];
        this.log('info', `도서별 데이터 영역 발견: ${targetContent.length} chars`);
        break;
      }
    }

    if (!targetContent) {
      targetContent = htmlContent;
    }

    // 3단계: 목차 전용 패턴들 (더 정밀하게)
    const tocExtractionPatterns = [
      // 테이블에서 "목차" 라벨과 함께 있는 내용
      /<(?:th|td)[^>]*>[\s]*(?:목차|차례|Table[\s]*of[\s]*Contents)[\s]*<\/(?:th|td)>[\s]*<(?:th|td)[^>]*>([\s\S]{30,3000}?)<\/(?:th|td)>/gi,
      
      // JSON 형태로 저장된 목차 데이터
      /["']?(?:toc|목차|차례|contents?)["']?\s*:\s*["']([\s\S]{50,3000}?)["']/gi,
      
      // 목차 전용 div 또는 section
      /<(?:div|section)[^>]*(?:class|id)="[^"]*(?:toc|목차|contents?)[^"]*"[^>]*>([\s\S]{50,3000}?)<\/(?:div|section)>/gi,
      
      // 리스트 형태의 목차
      /<(?:ul|ol)[^>]*class="[^"]*(?:toc|목차|contents?)[^"]*"[^>]*>([\s\S]{50,3000}?)<\/(?:ul|ol)>/gi,
      
      // 테이블 행에서 목차 데이터
      /<tr[^>]*>[\s]*<td[^>]*>(?:목차|차례|목록)<\/td>[\s]*<td[^>]*>([\s\S]{30,3000}?)<\/td>[\s]*<\/tr>/gi,
      
      // 목차 키워드 후 특정 구조
      /(?:목차|차례)[\s]*:[\s]*<[^>]*>([\s\S]{30,2000}?)<\/[^>]*>/gi,
      
      // 목차를 포함한 박스나 컨테이너
      /<(?:div|span)[^>]*>[\s]*(?:목차|차례)[\s]*<\/(?:div|span)>[\s]*<[^>]*>([\s\S]{30,2000}?)<\/[^>]*>/gi
    ];

    for (let i = 0; i < tocExtractionPatterns.length; i++) {
      const pattern = tocExtractionPatterns[i];
      const matches = [...targetContent.matchAll(pattern)];

      this.log('info', `목차 패턴 ${i+1} 매칭 수: ${matches.length}`);

      for (const match of matches) {
        const rawContent = match[1] || match[0];
        if (rawContent) {
          const cleanText = this.parseTableOfContentsText(rawContent);
          this.log('info', `추출된 텍스트 미리보기: "${cleanText.substring(0, 100)}..."`);

          // 잘못된 패턴 체크
          const isInvalid = invalidPatterns.some(invalidPattern => invalidPattern.test(cleanText.trim()));
          if (isInvalid) {
            this.log('warn', '잘못된 목차 패턴 감지, 건너뜀');
            continue;
          }

          if (this.isValidTableOfContents(cleanText)) {
            this.log('info', `유효한 목차 발견 (패턴 ${i+1}): ${cleanText.length} chars`);
            return cleanText;
          }
        }
      }
    }

    // 4단계: 최후 수단 - 전체 HTML에서 목차 같은 구조 찾기
    this.log('info', '최후 수단: 전체 HTML에서 목차 구조 탐색');
    const fullHtmlPatterns = [
      // 장/절 구조가 명확한 텍스트
      /(?:제\s*\d+\s*[장절편부][\s\S]{5,100}?\n){2,}/gi,
      // 번호가 있는 목록 구조
      /(?:\d+[.\s-][\s\S]{5,100}?\n){3,}/gi,
      // 한글 목차 패턴
      /(?:[가-희]+\s*[.\s][\s\S]{5,100}?\n){2,}/gi
    ];

    for (const pattern of fullHtmlPatterns) {
      const matches = [...htmlContent.matchAll(pattern)];
      for (const match of matches) {
        const cleanText = this.parseTableOfContentsText(match[0]);
        
        // 잘못된 패턴 체크
        const isInvalid = invalidPatterns.some(invalidPattern => invalidPattern.test(cleanText.trim()));
        if (isInvalid) {
          continue;
        }

        if (this.isValidTableOfContents(cleanText)) {
          this.log('info', `최후 수단으로 유효한 목차 발견: ${cleanText.length} chars`);
          return cleanText;
        }
      }
    }
    
    this.log('warn', 'HTML에서 유효한 목차를 찾을 수 없습니다.');
    return '';
  }

  /**
   * TXT 콘텐츠에서 목차 추출
   */
  private extractTOCFromTxtContent(txtContent: string): string {
    this.log('info', `TXT 콘텐츠에서 목차 추출 시도 (${txtContent.length} chars)`);
    
    if (!txtContent || txtContent.length < 10) return '';
    
    const lines = txtContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let tocStartIndex = -1;
    let tocEndIndex = -1;
    
    // 목차 시작점 찾기
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^목차|^차례|^CONTENTS?$/i.test(line) || 
          (/목차|차례/.test(line) && line.length < 20)) {
        tocStartIndex = i + 1;
        break;
      }
    }
    
    if (tocStartIndex === -1) {
      // 목차 헤더가 없으면 목차같은 패턴 찾기
      for (let i = 0; i < Math.min(lines.length, 50); i++) {
        const line = lines[i];
        if (/^(제\s*\d+[장절편부]|들어가는\s*글|나가는\s*글|\d+장\s|\d+[.\s-])/.test(line)) {
          tocStartIndex = i;
          break;
        }
      }
    }
    
    if (tocStartIndex === -1) return '';
    
    // 목차 끝점 찾기
    const endMarkers = [
      /^(서문|머리말|본문|1\s*\.|\(1\)|chapter\s*1|제\s*1\s*절|제\s*1\s*항)/i,
      /^(참고문헌|bibliography|색인|index|부록|appendix)/i
    ];
    
    for (let i = tocStartIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (endMarkers.some(marker => marker.test(line))) {
        tocEndIndex = i;
        break;
      }
      
      if (i - tocStartIndex > 100) {
        tocEndIndex = i;
        break;
      }
    }
    
    if (tocEndIndex === -1) {
      tocEndIndex = Math.min(lines.length, tocStartIndex + 50);
    }
    
    const tocLines = lines.slice(tocStartIndex, tocEndIndex)
      .filter(line => line.length > 2 && line.length < 200)
      .filter(line => !/^(page|페이지|\d+\s*$|출처|source)$/i.test(line));
    
    const result = tocLines.join('\n');
    this.log('info', `TXT에서 목차 추출 완료: ${result.length} chars`);
    return result;
  }

  /**
   * HTML 텍스트를 목차 형태로 파싱
   */
  private parseTableOfContentsText(htmlText: string): string {
    try {
      // HTML 태그 제거 및 텍스트 정리
      let text = htmlText
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:tr|li|p|div|h[1-6])>/gi, '\n')
        .replace(/<td[^>]*>/gi, ' | ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      const lines = text.split('\n').map(line => line.trim())
        .filter(line => {
          if (line.length < 2 || line.length > 300) return false;
          if (/^(목차|차례|contents|table|index)$/i.test(line)) return false;
          if (/^(page|페이지|\d+\s*$)/.test(line)) return false;
          
          // 목차 패턴 체크
          const tocPatterns = [
            /^\d+[.\s-]/,
            /^제\s*\d+[장절편부]/,
            /^\d+장\s/,
            /^[가-희]\s*[.\s]/,
            /^[IVX]+[.\s]/i,
            /^[부록|참고문헌|색인|찾아보기]/,
            /^들어가는\s*글|나가는\s*글|머리말|맺음말|서문|결문/,
            /^[\d\.]+\s+[가-희]/,
            /=\s*\d+\s*$/
          ];
          
          return tocPatterns.some(pattern => pattern.test(line));
        })
        .slice(0, 50);
      
      return lines.join('\n');
      
    } catch (error) {
      this.log('error', 'HTML 텍스트 파싱 오류', error);
      return '';
    }
  }

  /**
   * 목차 유효성 검증 (개선된 버전)
   */
  private isValidTableOfContents(text: string): boolean {
    if (!text || text.length < 5 || text.length > 8000) {
      return false;
    }
    
    // 명확히 잘못된 콘텐츠 필터링
    const invalidContentPatterns = [
      /^\s*\d+\s*\|\s*한강\s*$/,  // "1 | 한강" 같은 명확히 잘못된 콘텐츠
      /^\s*\d+\s*\|\s*[가-희]{1,5}\s*$/,  // 단순한 "숫자 | 한글" 패턴
      /^[\d\s\|\-=]+$/,  // 숫자와 기호만 있는 경우
      /^검색결과|^search result|^목록$|^list$/i,  // 검색 결과 제목
      /^\s*없음\s*$|^\s*not available\s*$/i,  // "없음" 같은 텍스트
      /^\s*loading\s*$|^\s*로딩\s*$/i,  // 로딩 텍스트
      /인기검색어|검색질의어|검색건수/,  // 인기검색어 섹션 (전체 텍스트에서)
      /베스트셀러|best.*seller/i,  // 베스트셀러 목록
      /신간도서|new.*book/i,  // 신간 도서 목록
      /추천도서|recommend/i,  // 추천 도서
      /편안함의\s*습격|경험의\s*멸종|혼모노|채식주의자|궤도|가공범/i  // 특정 인기검색어들
    ];
    
    for (const invalidPattern of invalidContentPatterns) {
      if (invalidPattern.test(text.trim())) {
        this.log('warn', `잘못된 목차 콘텐츠 감지: "${text.trim()}"`);
        return false;
      }
    }
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 1);
    if (lines.length < 1) return false;
    
    // 목차 패턴 체크 (더 엄격하게)
    const tocPatterns = [
      /\d+[.\s-]/g,  // 번호 패턴
      /제\s*\d+[장절편부]/g,  // 장절 패턴
      /\d+장\s/g,  // 장 패턴
      /[가-희]\s*[.\s]/g,  // 한글 번호
      /[IVX]+[.\s]/gi,  // 로마 숫자
      /[들어가는\s*글|나가는\s*글|머리말]/g,  // 서문/결문
      /=\s*\d+\s*$/gm  // 페이지 번호
    ];
    
    let totalMatches = 0;
    tocPatterns.forEach(pattern => {
      totalMatches += (text.match(pattern) || []).length;
    });
    
    const validLines = lines.filter(line => {
      // 너무 짧거나 긴 라인 제외
      if (line.length < 2 || line.length > 200) return false;
      
      // 목차 패턴 체크
      return (
        /^\d+/.test(line) ||
        /^제\s*\d+/.test(line) ||
        /^\d+장\s/.test(line) ||
        /^[가-희]\s*\./.test(line) ||
        /^[IVX]+\./.test(line) ||
        /^들어가는\s*글|^나가는\s*글/.test(line) ||
        /=\s*\d+\s*$/.test(line) ||
        (line.length >= 3 && line.length <= 100 && /[가-희]/.test(line) && !/^\d+\s*\|/.test(line))
      );
    });
    
    // 전체 텍스트에서 잘못된 패턴 먼저 체크 (우선순위 높음)
    for (const invalidPattern of invalidContentPatterns) {
      if (invalidPattern.test(text)) {
        this.log('warn', `잘못된 목차 콘텐츠 감지: "${text.substring(0, 50)}..."`);
        return false;
      }
    }

    const hasEnoughMatches = totalMatches >= 2;  // 더 엄격하게
    const hasEnoughLines = validLines.length >= 3;  // 최소 3줄로 더 엄격하게
    const hasKoreanContent = /[가-희]/.test(text);
    const hasReasonableLength = text.length >= 15 && text.length <= 5000;  // 최소 길이 증가
    const isNotOnlyNumbers = !/^[\d\s\|\-=\n]+$/.test(text);  // 숫자만 있는 건 아닌지
    const isNotSearchResults = !/\|\s*\d+\s*\|/.test(text);  // "| 1 |" 같은 검색결과 패턴 제외
    
    // 더 엄격한 조건: 유효한 라인이 충분해야 하고, 잘못된 패턴이 없어야 함
    const isValid = hasReasonableLength && 
                   hasKoreanContent && 
                   isNotOnlyNumbers && 
                   isNotSearchResults &&
                   hasEnoughLines &&  // 유효한 라인 수를 더 중요하게 봄
                   (hasEnoughMatches || hasEnoughLines);
    
    this.log('info', `목차 유효성 검증: ${isValid ? 'VALID' : 'INVALID'} (matches: ${totalMatches}, validLines: ${validLines.length}/${lines.length}, korean: ${hasKoreanContent}, notOnlyNumbers: ${isNotOnlyNumbers}, notSearchResults: ${isNotSearchResults})`);
    
    return isValid;
  }

  /**
   * 디버그 모드 설정
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}
