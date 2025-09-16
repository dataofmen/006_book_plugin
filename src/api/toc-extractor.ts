import { requestUrl } from 'obsidian';
import { Book } from './types';

/**
 * 목차 추출 결과 인터페이스
 */
export interface TOCExtractionResult {
  success: boolean;
  content?: string;
  method: string;
  confidence: number; // 0-1, 추출 결과의 신뢰도
  responseTime?: number;
  error?: string;
  metadata?: {
    source: string;
    patterns: string[];
    validationScore: number;
  };
}

/**
 * 목차 추출 전문 클래스
 * 다양한 방법을 통해 도서의 목차 정보를 추출합니다.
 */
export class TOCExtractor {
  private debugMode = true;
  private baseUrl = 'https://www.nl.go.kr';
  private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // 성공률 추적을 위한 통계
  private methodStats: Map<string, { attempts: number; successes: number }> = new Map();

  constructor(private apiKey: string) {}

  /**
   * 메인 목차 추출 메서드
   * 모든 방법을 순차적으로 시도하여 최적의 결과를 반환
   */
  async extractTableOfContents(book: Book): Promise<TOCExtractionResult> {
    this.log('info', `===== 목차 추출 시작: ${book.title} =====`);
    this.log('info', `controlNo: ${book.controlNo || 'None'}, ISBN: ${book.isbn || 'None'}`);

    const methods = [
      () => this.extractFromJSONLD(book),
      () => this.extractFromMetadata(book),
      () => this.extractFromDirectAPI(book),
      () => this.extractFromSearchResults(book),
      () => this.extractFromMultipleURLPatterns(book),
      () => this.extractFromEnhancedHTML(book)
    ];

    let bestResult: TOCExtractionResult | null = null;

    for (let i = 0; i < methods.length; i++) {
      const methodName = [
        'JSON-LD', 'Metadata', 'DirectAPI', 'SearchResults',
        'MultipleURLs', 'EnhancedHTML'
      ][i];

      try {
        this.log('info', `방법 ${i + 1}: ${methodName} 시도`);
        this.recordAttempt(methodName);

        const result = await methods[i]();

        if (result.success) {
          this.recordSuccess(methodName);
          this.log('info', `✅ ${methodName} 성공 (신뢰도: ${result.confidence})`);

          // 높은 신뢰도의 결과는 즉시 반환
          if (result.confidence >= 0.8) {
            return result;
          }

          // 낮은 신뢰도의 결과는 더 나은 결과가 나올 때까지 보관
          if (!bestResult || result.confidence > bestResult.confidence) {
            bestResult = result;
          }
        } else {
          this.log('warn', `❌ ${methodName} 실패: ${result.error}`);
        }

      } catch (error) {
        this.log('error', `${methodName} 오류:`, error);
      }
    }

    if (bestResult) {
      this.log('info', `최종 결과: ${bestResult.method} (신뢰도: ${bestResult.confidence})`);
      return bestResult;
    }

    return {
      success: false,
      method: 'all-failed',
      confidence: 0,
      error: '모든 목차 추출 방법이 실패했습니다.',
      metadata: {
        source: 'none',
        patterns: [],
        validationScore: 0
      }
    };
  }

  /**
   * 방법 1: JSON-LD 구조화된 데이터에서 목차 추출
   */
  private async extractFromJSONLD(book: Book): Promise<TOCExtractionResult> {
    const startTime = Date.now();

    if (!book.controlNo) {
      return this.createFailResult('JSON-LD', 'controlNo가 필요합니다', startTime);
    }

    try {
      const detailUrl = `${this.baseUrl}/NL/contents/detail.do?viewKey=${book.controlNo}`;
      const response = await this.makeRequest(detailUrl);

      if (!response.text) {
        return this.createFailResult('JSON-LD', '응답이 비어있습니다', startTime);
      }

      // JSON-LD 추출
      const jsonLDPatterns = [
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
        /<script[^>]*type="application\/json"[^>]*id="[^"]*book[^"]*"[^>]*>([\s\S]*?)<\/script>/gi,
        /var\s+bookData\s*=\s*(\{[\s\S]*?\});/gi,
        /window\.bookInfo\s*=\s*(\{[\s\S]*?\});/gi
      ];

      for (const pattern of jsonLDPatterns) {
        const matches = [...response.text.matchAll(pattern)];
        for (const match of matches) {
          try {
            const jsonData = JSON.parse(match[1]);
            const toc = this.extractTOCFromJSON(jsonData);

            if (toc) {
              const confidence = this.calculateConfidence(toc, 'json-structured');
              if (confidence > 0.5) {
                return {
                  success: true,
                  content: toc,
                  method: 'JSON-LD',
                  confidence,
                  responseTime: Date.now() - startTime,
                  metadata: {
                    source: detailUrl,
                    patterns: ['json-ld'],
                    validationScore: confidence
                  }
                };
              }
            }
          } catch (jsonError) {
            this.log('warn', 'JSON 파싱 실패:', jsonError);
          }
        }
      }

      return this.createFailResult('JSON-LD', 'JSON-LD 데이터에서 목차를 찾을 수 없습니다', startTime);

    } catch (error) {
      return this.createFailResult('JSON-LD', `오류: ${error.message}`, startTime);
    }
  }

  /**
   * 방법 2: 메타데이터 및 Open Graph에서 목차 추출
   */
  private async extractFromMetadata(book: Book): Promise<TOCExtractionResult> {
    const startTime = Date.now();

    if (!book.controlNo) {
      return this.createFailResult('Metadata', 'controlNo가 필요합니다', startTime);
    }

    try {
      const detailUrl = `${this.baseUrl}/NL/contents/detail.do?viewKey=${book.controlNo}`;
      const response = await this.makeRequest(detailUrl);

      if (!response.text) {
        return this.createFailResult('Metadata', '응답이 비어있습니다', startTime);
      }

      // 메타데이터 패턴들
      const metaPatterns = [
        /<meta[^>]*property="book:contents?"[^>]*content="([^"]*)"[^>]*>/gi,
        /<meta[^>]*name="description"[^>]*content="([^"]*목차[^"]*)"[^>]*>/gi,
        /<meta[^>]*name="toc"[^>]*content="([^"]*)"[^>]*>/gi,
        /<meta[^>]*property="og:description"[^>]*content="([^"]*목차[^"]*)"[^>]*>/gi
      ];

      for (const pattern of metaPatterns) {
        const matches = [...response.text.matchAll(pattern)];
        for (const match of matches) {
          const content = this.decodeHTMLEntities(match[1]);
          const toc = this.parseTableOfContentsText(content);

          if (toc && this.isValidTableOfContents(toc)) {
            const confidence = this.calculateConfidence(toc, 'metadata');
            return {
              success: true,
              content: toc,
              method: 'Metadata',
              confidence,
              responseTime: Date.now() - startTime,
              metadata: {
                source: detailUrl,
                patterns: ['meta-tags'],
                validationScore: confidence
              }
            };
          }
        }
      }

      return this.createFailResult('Metadata', '메타데이터에서 목차를 찾을 수 없습니다', startTime);

    } catch (error) {
      return this.createFailResult('Metadata', `오류: ${error.message}`, startTime);
    }
  }

  /**
   * 방법 3: 직접 API 호출을 통한 목차 추출
   */
  private async extractFromDirectAPI(book: Book): Promise<TOCExtractionResult> {
    const startTime = Date.now();

    if (!book.controlNo) {
      return this.createFailResult('DirectAPI', 'controlNo가 필요합니다', startTime);
    }

    try {
      // API 엔드포인트들 시도
      const apiUrls = [
        `${this.baseUrl}/api/v1/contents/${book.controlNo}/toc.json`,
        `${this.baseUrl}/NL/search/openApi/tocData.do?key=${this.apiKey}&controlNo=${book.controlNo}`,
        `${this.baseUrl}/seoji/contents/api/toc?CN=${book.controlNo}&format=json`,
        `${this.baseUrl}/api/contents/tableOfContents?viewKey=${book.controlNo}`,
        `${this.baseUrl}/contents/api/detail?id=${book.controlNo}&include=toc`
      ];

      for (const apiUrl of apiUrls) {
        try {
          const response = await this.makeRequest(apiUrl, {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          });

          if (response.text) {
            let data;
            try {
              data = JSON.parse(response.text);
            } catch {
              // JSON이 아닐 수 있으므로 텍스트로 처리
              const toc = this.parseTableOfContentsText(response.text);
              if (toc && this.isValidTableOfContents(toc)) {
                const confidence = this.calculateConfidence(toc, 'direct-api-text');
                return {
                  success: true,
                  content: toc,
                  method: 'DirectAPI',
                  confidence,
                  responseTime: Date.now() - startTime,
                  metadata: {
                    source: apiUrl,
                    patterns: ['api-text-response'],
                    validationScore: confidence
                  }
                };
              }
              continue;
            }

            const toc = this.extractTOCFromJSON(data);
            if (toc) {
              const confidence = this.calculateConfidence(toc, 'direct-api-json');
              return {
                success: true,
                content: toc,
                method: 'DirectAPI',
                confidence,
                responseTime: Date.now() - startTime,
                metadata: {
                  source: apiUrl,
                  patterns: ['api-json-response'],
                  validationScore: confidence
                }
              };
            }
          }
        } catch (apiError) {
          this.log('warn', `API URL 실패: ${apiUrl}`, apiError);
        }
      }

      return this.createFailResult('DirectAPI', '모든 API 엔드포인트에서 목차를 찾을 수 없습니다', startTime);

    } catch (error) {
      return this.createFailResult('DirectAPI', `오류: ${error.message}`, startTime);
    }
  }

  /**
   * 방법 4: 검색 결과에서 목차 정보 추출
   */
  private async extractFromSearchResults(book: Book): Promise<TOCExtractionResult> {
    const startTime = Date.now();

    try {
      // 제목과 저자로 검색
      const searchQuery = encodeURIComponent(`${book.title} ${book.author}`);
      const searchUrl = `${this.baseUrl}/NL/search/openApi/search.do?key=${this.apiKey}&kwd=${searchQuery}&apiType=json&pageSize=10`;

      const response = await this.makeRequest(searchUrl);

      if (!response.text) {
        return this.createFailResult('SearchResults', '검색 응답이 비어있습니다', startTime);
      }

      let searchData;
      try {
        searchData = JSON.parse(response.text);
      } catch {
        return this.createFailResult('SearchResults', 'JSON 파싱 실패', startTime);
      }

      const results = searchData.result || searchData.docs || [];

      for (const result of results) {
        // 제목이 유사한 결과 찾기
        if (this.isSimilarTitle(book.title, result.title_info || result.TITLE)) {
          // 검색 결과에서 목차 관련 필드 찾기
          const tocFields = [
            'tableOfContents', 'toc', 'contents', 'summary',
            'description', 'detail', 'outline', 'structure'
          ];

          for (const field of tocFields) {
            if (result[field]) {
              const toc = this.parseTableOfContentsText(result[field]);
              if (toc && this.isValidTableOfContents(toc)) {
                const confidence = this.calculateConfidence(toc, 'search-results');
                return {
                  success: true,
                  content: toc,
                  method: 'SearchResults',
                  confidence,
                  responseTime: Date.now() - startTime,
                  metadata: {
                    source: searchUrl,
                    patterns: [`search-field-${field}`],
                    validationScore: confidence
                  }
                };
              }
            }
          }
        }
      }

      return this.createFailResult('SearchResults', '검색 결과에서 목차를 찾을 수 없습니다', startTime);

    } catch (error) {
      return this.createFailResult('SearchResults', `오류: ${error.message}`, startTime);
    }
  }

  /**
   * 방법 5: 다양한 URL 패턴으로 목차 페이지 접근
   */
  private async extractFromMultipleURLPatterns(book: Book): Promise<TOCExtractionResult> {
    const startTime = Date.now();

    if (!book.controlNo) {
      return this.createFailResult('MultipleURLs', 'controlNo가 필요합니다', startTime);
    }

    try {
      // 다양한 URL 패턴들
      const urlPatterns = [
        `${this.baseUrl}/NL/contents/detail.do?viewKey=${book.controlNo}`,
        `${this.baseUrl}/NL/contents/search.do?viewKey=${book.controlNo}&viewType=AH1&tab=toc`,
        `${this.baseUrl}/NL/contents/search.do?viewKey=${book.controlNo}&viewType=AH2`,
        `${this.baseUrl}/NL/contents/search.do?viewKey=${book.controlNo}&viewType=AH3`,
        `${this.baseUrl}/NL/contents/detail.do?viewKey=${book.controlNo}&section=toc`,
        `${this.baseUrl}/library/detail/${book.controlNo}`,
        `${this.baseUrl}/book/detail/${book.controlNo}`,
        `${this.baseUrl}/contents/${book.controlNo}/toc`,
        `${this.baseUrl}/search/detail?cn=${book.controlNo}`,
        `${this.baseUrl}/detail?viewKey=${book.controlNo}&type=toc`
      ];

      for (const url of urlPatterns) {
        try {
          const response = await this.makeRequest(url);

          if (response.text) {
            const toc = this.extractTOCFromDetailPageHTML(response.text, book.controlNo, book.title);
            if (toc && this.isValidTableOfContents(toc)) {
              const confidence = this.calculateConfidence(toc, 'multiple-urls');
              return {
                success: true,
                content: toc,
                method: 'MultipleURLs',
                confidence,
                responseTime: Date.now() - startTime,
                metadata: {
                  source: url,
                  patterns: ['url-pattern-success'],
                  validationScore: confidence
                }
              };
            }
          }
        } catch (urlError) {
          this.log('warn', `URL 패턴 실패: ${url}`, urlError);
        }
      }

      return this.createFailResult('MultipleURLs', '모든 URL 패턴에서 목차를 찾을 수 없습니다', startTime);

    } catch (error) {
      return this.createFailResult('MultipleURLs', `오류: ${error.message}`, startTime);
    }
  }

  /**
   * 방법 6: 강화된 HTML 파싱
   */
  private async extractFromEnhancedHTML(book: Book): Promise<TOCExtractionResult> {
    const startTime = Date.now();

    if (!book.controlNo) {
      return this.createFailResult('EnhancedHTML', 'controlNo가 필요합니다', startTime);
    }

    try {
      const detailUrl = `${this.baseUrl}/NL/contents/detail.do?viewKey=${book.controlNo}`;
      const response = await this.makeRequest(detailUrl);

      if (!response.text) {
        return this.createFailResult('EnhancedHTML', '응답이 비어있습니다', startTime);
      }

      // 강화된 HTML 파싱으로 목차 추출
      const toc = this.enhancedHTMLParsing(response.text, book);

      if (toc && this.isValidTableOfContents(toc)) {
        const confidence = this.calculateConfidence(toc, 'enhanced-html');
        return {
          success: true,
          content: toc,
          method: 'EnhancedHTML',
          confidence,
          responseTime: Date.now() - startTime,
          metadata: {
            source: detailUrl,
            patterns: ['enhanced-html-parsing'],
            validationScore: confidence
          }
        };
      }

      return this.createFailResult('EnhancedHTML', '강화된 HTML 파싱에서 목차를 찾을 수 없습니다', startTime);

    } catch (error) {
      return this.createFailResult('EnhancedHTML', `오류: ${error.message}`, startTime);
    }
  }

  /**
   * JSON 데이터에서 목차 추출
   */
  private extractTOCFromJSON(data: any): string | null {
    // JSON에서 목차 관련 필드들 검색
    const tocFields = [
      'tableOfContents', 'toc', 'contents', 'outline', 'structure',
      'summary', 'description', 'chapters', 'sections', 'index'
    ];

    const searchInObject = (obj: any, depth = 0): string | null => {
      if (depth > 5 || !obj || typeof obj !== 'object') return null;

      for (const field of tocFields) {
        if (obj[field] && typeof obj[field] === 'string') {
          const toc = this.parseTableOfContentsText(obj[field]);
          if (toc && this.isValidTableOfContents(toc)) {
            return toc;
          }
        }
      }

      // 중첩 객체 탐색
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
          const result = searchInObject(obj[key], depth + 1);
          if (result) return result;
        }
      }

      return null;
    };

    return searchInObject(data);
  }

  /**
   * 강화된 HTML 파싱
   */
  private enhancedHTMLParsing(html: string, book: Book): string {
    // 1. 숨겨진 div나 데이터 속성에서 목차 찾기
    const hiddenDataPatterns = [
      /<div[^>]*data-toc="([^"]*)"[^>]*>/gi,
      /<div[^>]*id="[^"]*toc[^"]*"[^>]*style="display:\s*none"[^>]*>([\s\S]*?)<\/div>/gi,
      /<script[^>]*>[\s\S]*?toc[\s\S]*?'([^']*목차[^']*)'[\s\S]*?<\/script>/gi
    ];

    for (const pattern of hiddenDataPatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        const content = this.decodeHTMLEntities(match[1]);
        const toc = this.parseTableOfContentsText(content);
        if (toc && this.isValidTableOfContents(toc)) {
          return toc;
        }
      }
    }

    // 2. 주석에 숨겨진 목차 데이터
    const commentPatterns = [
      /<!--[\s\S]*?목차[\s\S]*?(제\s*\d+\s*장[\s\S]*?)-->/gi,
      /<!--[\s\S]*?TOC[\s\S]*?([\s\S]*?)-->/gi
    ];

    for (const pattern of commentPatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        const toc = this.parseTableOfContentsText(match[1]);
        if (toc && this.isValidTableOfContents(toc)) {
          return toc;
        }
      }
    }

    // 3. 기본 HTML 파싱 (기존 로직 활용)
    return this.extractTOCFromDetailPageHTML(html, book.controlNo || '', book.title);
  }

  /**
   * HTML에서 상세 목차 추출 (기존 로직 개선)
   */
  private extractTOCFromDetailPageHTML(html: string, controlNo: string, bookTitle: string): string {
    // 기존 TOCService의 로직을 개선하여 사용
    // 더 정확한 패턴 매칭과 필터링 적용

    const tocPatterns = [
      // 더 정확한 목차 테이블 패턴
      /<table[^>]*(?:class|id)="[^"]*(?:toc|목차|contents)[^"]*"[^>]*>([\s\S]{100,5000}?)<\/table>/gi,

      // 목차 전용 div 섹션
      /<div[^>]*(?:class|id)="[^"]*(?:toc|목차|contents)[^"]*"[^>]*>([\s\S]{100,5000}?)<\/div>/gi,

      // 리스트 형태의 목차
      /<(?:ul|ol)[^>]*(?:class|id)="[^"]*(?:toc|목차|contents)[^"]*"[^>]*>([\s\S]{100,5000}?)<\/(?:ul|ol)>/gi,

      // 테이블 행에서 목차 라벨과 내용
      /<tr[^>]*>[\s\S]*?<(?:th|td)[^>]*>[\s]*(?:목차|차례|Contents)[\s]*<\/(?:th|td)>[\s]*<(?:th|td)[^>]*>([\s\S]{100,5000}?)<\/(?:th|td)>[\s\S]*?<\/tr>/gi
    ];

    for (const pattern of tocPatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        const rawContent = match[1];
        const toc = this.parseTableOfContentsText(rawContent);

        if (toc && this.isValidTableOfContents(toc)) {
          return toc;
        }
      }
    }

    return '';
  }

  /**
   * HTML 텍스트를 목차 형태로 파싱
   */
  private parseTableOfContentsText(htmlText: string): string {
    if (!htmlText) return '';

    try {
      // HTML 태그 제거 및 텍스트 정리
      let text = htmlText
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
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
          if (line.length < 3 || line.length > 300) return false;

          // 목차 헤더 제거
          if (/^(목차|차례|contents|table|index)$/i.test(line)) return false;

          // 페이지 번호만 있는 라인 제거
          if (/^(page|페이지|\d+\s*$)/.test(line)) return false;

          // 목차 패턴 확인
          const tocPatterns = [
            /^\d+[.\s-]/,                    // 1. 2. 3.
            /^제\s*\d+[장절편부]/,          // 제1장
            /^\d+장\s/,                     // 1장
            /^[가-힣]\s*[.\s]/,             // 가. 나.
            /^[IVX]+[.\s]/i,                // I. II.
            /^[부록|참고문헌|색인]/,         // 책의 구조 요소
            /^들어가는\s*글|나가는\s*글/,    // 서문/결문
            /=\s*\d+\s*$/,                  // 페이지 번호
            /^[\d\.]+\s+[가-힣]/            // 1.1 제목
          ];

          return tocPatterns.some(pattern => pattern.test(line));
        })
        .slice(0, 100); // 최대 100개 항목

      return lines.join('\n');

    } catch (error) {
      this.log('error', 'HTML 텍스트 파싱 오류:', error);
      return '';
    }
  }

  /**
   * 목차 유효성 검증
   */
  private isValidTableOfContents(text: string): boolean {
    if (!text || text.length < 10 || text.length > 10000) {
      return false;
    }

    // 잘못된 콘텐츠 패턴 (강화됨)
    const invalidPatterns = [
      /^\s*\d+\s*\|\s*한강\s*$/,                    // "1 | 한강" 같은 검색결과
      /^\s*\d+\s*\|\s*[가-힣]{1,5}\s*$/,          // 단순 "숫자 | 한글"
      /^[\d\s\|\-=]+$/,                           // 숫자와 기호만
      /인기검색어|검색질의어|베스트셀러|신간도서/,    // 웹사이트 요소
      /편안함의\s*습격|경험의\s*멸종|혼모노/,       // 특정 인기검색어
      /검색결과|목록$|list$/i,                     // 검색 결과 제목
      /loading|로딩|없음|not\s*available/i        // 로딩/오류 메시지
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(text)) {
        return false;
      }
    }

    const lines = text.split('\n').filter(line => line.trim().length > 1);

    // 최소 3줄 이상의 유효한 목차 항목 필요
    const validLines = lines.filter(line => {
      return /^\d+[.\s-]|^제\s*\d+|^[가-힣]\s*\.|^들어가는|^나가는|=\s*\d+\s*$/.test(line);
    });

    return validLines.length >= 3 && /[가-힣]/.test(text);
  }

  /**
   * 목차 내용의 신뢰도 계산
   */
  private calculateConfidence(toc: string, method: string): number {
    let confidence = 0.5; // 기본 신뢰도

    const lines = toc.split('\n').filter(line => line.trim().length > 0);

    // 라인 수에 따른 가산점
    if (lines.length >= 10) confidence += 0.2;
    else if (lines.length >= 5) confidence += 0.1;

    // 목차 패턴 다양성
    const patterns = [
      /^\d+[.\s-]/,           // 번호
      /^제\s*\d+[장절]/,      // 장절
      /^[가-힣]\s*[.\s]/,     // 한글번호
      /=\s*\d+\s*$/,          // 페이지번호
      /들어가는\s*글|나가는\s*글/ // 서문결문
    ];

    const matchedPatterns = patterns.filter(pattern =>
      lines.some(line => pattern.test(line))
    );

    confidence += matchedPatterns.length * 0.05;

    // 방법별 가중치
    const methodWeights: Record<string, number> = {
      'json-structured': 0.3,
      'direct-api-json': 0.25,
      'metadata': 0.2,
      'enhanced-html': 0.15,
      'multiple-urls': 0.1,
      'search-results': 0.05
    };

    confidence += methodWeights[method] || 0;

    // 전체 길이에 따른 조정
    if (toc.length > 1000) confidence += 0.1;
    else if (toc.length < 100) confidence -= 0.1;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 제목 유사도 검사
   */
  private isSimilarTitle(title1: string, title2: string): boolean {
    if (!title1 || !title2) return false;

    const normalize = (str: string) => str.replace(/[^\w가-힣]/g, '').toLowerCase();
    const n1 = normalize(title1);
    const n2 = normalize(title2);

    // 완전 일치
    if (n1 === n2) return true;

    // 포함 관계 (70% 이상)
    const longer = n1.length > n2.length ? n1 : n2;
    const shorter = n1.length > n2.length ? n2 : n1;

    return longer.includes(shorter) && shorter.length / longer.length >= 0.7;
  }

  /**
   * HTML 엔티티 디코딩
   */
  private decodeHTMLEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * HTTP 요청 수행
   */
  private async makeRequest(url: string, additionalHeaders?: Record<string, string>): Promise<any> {
    const headers = {
      'User-Agent': this.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      ...additionalHeaders
    };

    return await requestUrl({
      url,
      method: 'GET',
      headers
    });
  }

  /**
   * 실패 결과 생성
   */
  private createFailResult(method: string, error: string, startTime: number): TOCExtractionResult {
    return {
      success: false,
      method,
      confidence: 0,
      error,
      responseTime: Date.now() - startTime,
      metadata: {
        source: 'none',
        patterns: [],
        validationScore: 0
      }
    };
  }

  /**
   * 통계 기록
   */
  private recordAttempt(method: string): void {
    if (!this.methodStats.has(method)) {
      this.methodStats.set(method, { attempts: 0, successes: 0 });
    }
    this.methodStats.get(method)!.attempts++;
  }

  private recordSuccess(method: string): void {
    this.methodStats.get(method)!.successes++;
  }

  /**
   * 성공률 통계 조회
   */
  getMethodStats(): Record<string, { attempts: number; successes: number; successRate: number }> {
    const stats: Record<string, { attempts: number; successes: number; successRate: number }> = {};

    this.methodStats.forEach((value, key) => {
      stats[key] = {
        attempts: value.attempts,
        successes: value.successes,
        successRate: value.attempts > 0 ? value.successes / value.attempts : 0
      };
    });

    return stats;
  }

  /**
   * 디버그 로그
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.debugMode) return;

    const timestamp = new Date().toISOString();
    const prefix = `📖 [TOCExtractor-${level.toUpperCase()}] ${timestamp}`;

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
   * 디버그 모드 설정
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}