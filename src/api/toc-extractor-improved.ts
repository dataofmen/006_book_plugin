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
 * 개선된 목차 추출 클래스
 * Kakao Book 방식을 참고하여 NLK API 목차 추출 성공률 향상
 */
export class ImprovedTOCExtractor {
  private debugMode = true;
  private baseUrl = 'https://www.nl.go.kr';
  private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // 성공률 추적을 위한 통계
  private methodStats: Map<string, { attempts: number; successes: number }> = new Map();

  constructor(private apiKey: string) {}

  /**
   * 메인 목차 추출 메서드 (개선됨)
   * Kakao Book의 효율적인 접근 방식을 적용
   */
  async extractTableOfContents(book: Book): Promise<TOCExtractionResult> {
    this.log('info', `===== 개선된 목차 추출 시작: ${book.title} =====`);
    this.log('info', `controlNo: ${book.controlNo || 'None'}, ISBN: ${book.isbn || 'None'}`);

    // 개선된 방법들 - 성공률 높은 순서로 재배열
    const methods = [
      () => this.extractFromTargetedHTML(book),     // 1. 타겟 HTML 파싱 (Kakao 방식)
      () => this.extractFromDirectAPI(book),        // 2. 직접 API
      () => this.extractFromEnhancedMetadata(book), // 3. 강화된 메타데이터
      () => this.extractFromLimitedFallback(book)   // 4. 제한적 폴백
    ];

    let bestResult: TOCExtractionResult | null = null;

    for (let i = 0; i < methods.length; i++) {
      const methodName = [
        'TargetedHTML', 'DirectAPI', 'EnhancedMetadata', 'LimitedFallback'
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
   * 방법 1: 타겟 HTML 파싱 (Kakao Book 방식 적용)
   * 가장 성공률이 높은 방법을 첫 번째로 배치
   */
  private async extractFromTargetedHTML(book: Book): Promise<TOCExtractionResult> {
    const startTime = Date.now();

    if (!book.controlNo) {
      return this.createFailResult('TargetedHTML', 'controlNo가 필요합니다', startTime);
    }

    try {
      const detailUrl = `${this.baseUrl}/NL/contents/detail.do?viewKey=${book.controlNo}`;
      const response = await this.makeRequest(detailUrl);

      if (!response.text) {
        return this.createFailResult('TargetedHTML', '응답이 비어있습니다', startTime);
      }

      // Kakao Book 방식의 단계적 HTML 파싱 적용
      const toc = this.parseHTMLWithKakaoMethod(response.text, book);

      if (toc && this.isValidTableOfContentsStrict(toc)) {
        const confidence = this.calculateConfidence(toc, 'targeted-html');
        return {
          success: true,
          content: toc,
          method: 'TargetedHTML',
          confidence,
          responseTime: Date.now() - startTime,
          metadata: {
            source: detailUrl,
            patterns: ['kakao-style-parsing'],
            validationScore: confidence
          }
        };
      }

      return this.createFailResult('TargetedHTML', '타겟 HTML 파싱에서 목차를 찾을 수 없습니다', startTime);

    } catch (error) {
      return this.createFailResult('TargetedHTML', `오류: ${error.message}`, startTime);
    }
  }

  /**
   * Kakao Book 방식의 HTML 파싱 적용 (NLK 구조에 맞게 조정)
   */
  private parseHTMLWithKakaoMethod(html: string, book: Book): string | null {
    try {
      this.log('info', 'Kakao 방식 HTML 파싱 시작');

      let tocContent = null;

      // 1. NLK 사이트의 목차 전용 섹션 타겟팅
      const nlkSpecificPatterns = [
        // NLK 상세 페이지의 목차 테이블
        /<table[^>]*class="[^"]*(?:toc|목차|contents|table_of_contents)[^"]*"[^>]*>([\s\S]{100,3000}?)<\/table>/gi,
        
        // NLK 상세 정보 영역
        /<div[^>]*class="[^"]*(?:detail|info|contents)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        
        // 도서 정보 테이블 내 목차 행
        /<tr[^>]*>[\s\S]*?<(?:th|td)[^>]*>[\s]*(?:목차|차례|Contents|Table)[\s]*<\/(?:th|td)>[\s]*<(?:th|td)[^>]*>([\s\S]{50,2000}?)<\/(?:th|td)>[\s\S]*?<\/tr>/gi
      ];

      // 1단계: 명확한 목차 섹션에서 추출
      for (const pattern of nlkSpecificPatterns) {
        const matches = [...html.matchAll(pattern)];
        for (const match of matches) {
          const candidateContent = this.extractPotentialTOCFromHTML(match[1]);
          
          if (candidateContent && this.isValidTableOfContentsStrict(candidateContent)) {
            tocContent = candidateContent;
            this.log('info', 'NLK 전용 패턴에서 목차 발견');
            break;
          }
        }
        if (tocContent) break;
      }

      // 2단계: 일반적인 목차 패턴 (더 엄격한 검증)
      if (!tocContent) {
        this.log('info', '일반 목차 패턴으로 폴백');
        
        const generalTocPatterns = [
          // 목차 헤더 다음에 오는 구조화된 내용
          /(?:목차|차례|Contents)[\s\S]{0,100}?<(?:table|div|ul|ol)[^>]*>([\s\S]{100,2000}?)<\/(?:table|div|ul|ol)>/gi,
          
          // 여러 장/부 구조가 포함된 테이블 셀
          /<(?:td|div)[^>]*>(?:[\s\S]*?(?:제?\s*\d+\s*[장부절편권화][\s\S]{10,100}?)){3,}[\s\S]*?<\/(?:td|div)>/gi
        ];

        for (const pattern of generalTocPatterns) {
          const matches = [...html.matchAll(pattern)];
          for (const match of matches) {
            const candidateContent = this.extractPotentialTOCFromHTML(match[1]);
            
            if (candidateContent && this.isValidTableOfContentsStrict(candidateContent)) {
              tocContent = candidateContent;
              this.log('info', '일반 패턴에서 목차 발견');
              break;
            }
          }
          if (tocContent) break;
        }
      }

      // 3단계: 제한적 텍스트 패턴 검색 (매우 엄격)
      if (!tocContent) {
        this.log('info', '제한적 텍스트 패턴 검색');
        
        // 매우 구체적인 목차 구조만 허용
        const restrictedTextPatterns = [
          // 최소 3개의 장/부 구조
          /(?:제?\s*\d+\s*[장부절편][\s\S]{5,80}?(?:\n|<br>|<\/[^>]*>)){3,}/gi,
          
          // 번호가 있는 목차 항목들
          /(?:\d+\.\s*[가-힣][\s\S]{5,80}?(?:\n|<br>|<\/[^>]*>)){3,}/gi
        ];

        for (const pattern of restrictedTextPatterns) {
          const matches = [...html.matchAll(pattern)];
          for (const match of matches) {
            const candidateContent = this.extractPotentialTOCFromHTML(match[0]);
            
            if (candidateContent && this.isValidTableOfContentsStrict(candidateContent)) {
              tocContent = candidateContent;
              this.log('info', '제한적 텍스트 패턴에서 목차 발견');
              break;
            }
          }
          if (tocContent) break;
        }
      }

      if (tocContent) {
        return this.cleanTableOfContentsTextAdvanced(tocContent);
      }

      return null;

    } catch (error) {
      this.log('error', 'Kakao 방식 HTML 파싱 오류', error);
      return null;
    }
  }

  /**
   * HTML에서 잠재적인 목차 추출 (Kakao 방식)
   */
  private extractPotentialTOCFromHTML(htmlContent: string): string | null {
    try {
      // 1. 스크립트/스타일 태그 제거
      let content = htmlContent
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '');

      // 2. 테이블 구조 분석 (tr > td 패턴)
      const tableRows = content.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
      if (tableRows && tableRows.length > 0) {
        const tableContent: string[] = [];
        
        for (const row of tableRows) {
          const cellMatch = row.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi);
          if (cellMatch) {
            for (const cell of cellMatch) {
              const cellText = this.extractTextFromHTML(cell);
              if (cellText && cellText.trim().length > 0) {
                tableContent.push(cellText.trim());
              }
            }
          }
        }
        
        if (tableContent.length > 0) {
          return tableContent.join('\n');
        }
      }

      // 3. 리스트 구조 분석 (li 태그)
      const listItems = content.match(/<li[^>]*>[\s\S]*?<\/li>/gi);
      if (listItems && listItems.length > 0) {
        const listContent: string[] = [];
        
        for (const item of listItems) {
          const itemText = this.extractTextFromHTML(item);
          if (itemText && itemText.trim().length > 0) {
            listContent.push(itemText.trim());
          }
        }
        
        if (listContent.length > 0) {
          return listContent.join('\n');
        }
      }

      // 4. 단락 구조 분석 (p 태그)
      const paragraphs = content.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
      if (paragraphs && paragraphs.length > 0) {
        const paragraphContent: string[] = [];
        
        for (const para of paragraphs) {
          const paraText = this.extractTextFromHTML(para);
          if (paraText && paraText.trim().length > 0) {
            paragraphContent.push(paraText.trim());
          }
        }
        
        if (paragraphContent.length > 0) {
          return paragraphContent.join('\n');
        }
      }

      // 5. 일반 텍스트 추출
      return this.extractTextFromHTML(content);

    } catch (error) {
      this.log('error', 'HTML 목차 추출 오류', error);
      return null;
    }
  }

  /**
   * 엄격한 목차 유효성 검증 (Kakao 방식 개선)
   */
  private isValidTableOfContentsStrict(text: string): boolean {
    if (!text || text.length < 20 || text.length > 8000) {
      this.log('warn', 'TOC 검증 실패: 텍스트 길이 부적절', { length: text?.length || 0 });
      return false;
    }

    const cleanText = text.trim();
    const lowerText = cleanText.toLowerCase();

    // 1. 명백한 비목차 콘텐츠 필터링 (Kakao 방식 + NLK 특화)
    const invalidPatterns = [
      // NLK 특화 필터
      /검색\s*결과|도서\s*목록|관련\s*도서/,
      /이전\s*페이지|다음\s*페이지|페이지\s*이동/,
      /국립중앙도서관|저작권|copyright/i,
      /자료실|소장처|청구기호/,
      
      // 일반적인 책 소개 패턴 (Kakao에서 가져옴)
      /이 책은|이번 책에서|저자는|책에서는/,
      /독자들에게|우리에게|여러분에게/,
      /하지만|그러나|그런데\s+[가-힣\s]{30,}/,
      
      // 서술형 문장 (개선됨)
      /입니다\.|습니다\.|됩니다\.|했습니다\./,
      /것이다\.|것입니다\.|것이며|한다\./,
      /^[가-힣\s]{150,}$/, // 150자 이상의 긴 서술문
      
      // 단순 나열 (숫자+텍스트만)
      /^\s*\d+\s*\|\s*[가-힣]{1,10}\s*$/,
      /^[\d\s\|\-=]+$/,
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(cleanText)) {
        this.log('warn', 'TOC 검증 실패: 비목차 패턴 감지', {
          pattern: pattern.source.substring(0, 30) + '...'
        });
        return false;
      }
    }

    // 2. 확실한 목차 패턴 확인 (강화됨)
    const strongTocPatterns = [
      /(?:제\s*)?\d+\s*[장부절편권화]/,      // "제1장", "2부", "3절" 등
      /chapter\s*\d+|part\s*\d+/i,          // 영문 장/부
      /\d+\.\s*[가-힣]/,                    // "1. 제목"
      /\d+\)\s*[가-힣]/,                    // "1) 제목"
      /^[IVX]+\.\s*[가-힣]/m,               // "I. 제목"
      /서문|머리말|들어가는\s*말|시작하며/,    // 책의 구조 요소
      /부록|참고문헌|찾아보기|색인/,         // 책의 후미 요소
    ];

    let strongPatternCount = 0;
    for (const pattern of strongTocPatterns) {
      if (pattern.test(cleanText)) {
        strongPatternCount++;
      }
    }

    // 3. 구조적 분석 (개선됨)
    const lines = cleanText.split(/\n+/).filter(line => line.trim().length > 2);
    
    if (lines.length < 3) {
      this.log('warn', 'TOC 검증 실패: 목차 항목 수 부족', { lineCount: lines.length });
      return false;
    }

    // 4. 라인별 품질 분석
    let validLineCount = 0;
    let totalLength = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      totalLength += trimmed.length;

      // 적절한 목차 항목 길이 (5-100자)
      if (trimmed.length >= 5 && trimmed.length <= 100) {
        validLineCount++;
      }
    }

    const avgLineLength = totalLength / lines.length;
    const validLineRatio = validLineCount / lines.length;

    this.log('info', 'TOC 구조 분석', {
      lineCount: lines.length,
      strongPatternCount,
      avgLineLength: avgLineLength.toFixed(1),
      validLineRatio: validLineRatio.toFixed(2)
    });

    // 5. 최종 판정 (더 엄격한 기준)
    if (strongPatternCount >= 2) {
      this.log('info', 'TOC 검증 성공: 강한 목차 패턴 다수 발견');
      return true;
    }

    if (strongPatternCount >= 1 && 
        lines.length >= 5 && 
        validLineRatio >= 0.7 && 
        avgLineLength >= 10 && 
        avgLineLength <= 60) {
      this.log('info', 'TOC 검증 성공: 강한 패턴 + 좋은 구조');
      return true;
    }

    this.log('warn', 'TOC 검증 실패: 목차 조건 미충족');
    return false;
  }

  /**
   * 고급 목차 텍스트 정리 (Kakao 방식 적용)
   */
  private cleanTableOfContentsTextAdvanced(text: string): string {
    try {
      // 1. 기본 HTML 정리
      let cleaned = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:tr|li|p|div|h[1-6])>/gi, '\n')
        .replace(/<td[^>]*>/gi, ' | ')
        .replace(/<[^>]*>/g, ' ');

      // 2. HTML 엔티티 디코딩
      cleaned = this.decodeHTMLEntities(cleaned);

      // 3. 공백 정규화
      cleaned = cleaned
        .replace(/\s+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .replace(/\s+\n/g, '\n');

      // 4. 라인별 정리 및 필터링
      const lines = cleaned.split('\n')
        .map(line => line.trim())
        .filter(line => {
          // 빈 라인 제거
          if (line.length < 3) return false;
          
          // 너무 긴 라인 제거 (설명문일 가능성)
          if (line.length > 150) return false;
          
          // 목차 헤더 제거
          if (/^(목차|차례|contents|table)$/i.test(line)) return false;
          
          // 페이지 번호만 있는 라인 제거
          if (/^(page|페이지|\d+\s*$)/.test(line)) return false;
          
          // 구분자만 있는 라인 제거
          if (/^[\|\-\=\s]+$/.test(line)) return false;

          return true;
        });

      // 5. 중복 제거 및 순서 정리
      const uniqueLines = [...new Set(lines)];
      
      // 6. 목차 순서 정렬 시도 (선택적)
      const sortedLines = this.sortTableOfContentsIfPossible(uniqueLines);

      return sortedLines.join('\n').trim();

    } catch (error) {
      this.log('error', '목차 텍스트 정리 오류', error);
      return text; // 오류 시 원본 반환
    }
  }

  /**
   * 목차 순서 정렬 (가능한 경우)
   */
  private sortTableOfContentsIfPossible(lines: string[]): string[] {
    try {
      // 번호가 있는 라인들과 없는 라인들 분리
      const numberedLines: { line: string; number: number }[] = [];
      const unnumberedLines: string[] = [];

      for (const line of lines) {
        // 숫자로 시작하는 패턴
        const numberMatch = line.match(/^(\d+)[.\)\s]/);
        if (numberMatch) {
          numberedLines.push({
            line,
            number: parseInt(numberMatch[1])
          });
        } else {
          unnumberedLines.push(line);
        }
      }

      // 번호가 있는 라인들 정렬
      numberedLines.sort((a, b) => a.number - b.number);

      // 정렬된 결과 합치기
      const sortedNumbered = numberedLines.map(item => item.line);
      
      return [...sortedNumbered, ...unnumberedLines];

    } catch (error) {
      this.log('warn', '목차 정렬 실패, 원본 순서 유지', error);
      return lines;
    }
  }

  /**
   * 방법 2: 직접 API 호출 (기존 로직 유지하되 개선)
   */
  private async extractFromDirectAPI(book: Book): Promise<TOCExtractionResult> {
    const startTime = Date.now();

    if (!book.controlNo) {
      return this.createFailResult('DirectAPI', 'controlNo가 필요합니다', startTime);
    }

    try {
      // 가장 가능성 높은 API 엔드포인트들만 선별
      const apiUrls = [
        `${this.baseUrl}/NL/search/openApi/tocData.do?key=${this.apiKey}&controlNo=${book.controlNo}`,
        `${this.baseUrl}/api/contents/tableOfContents?viewKey=${book.controlNo}`,
        `${this.baseUrl}/seoji/contents/api/toc?CN=${book.controlNo}&format=json`
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
              const toc = this.extractTOCFromJSON(data);
              if (toc && this.isValidTableOfContentsStrict(toc)) {
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
            } catch {
              // JSON이 아닐 수 있으므로 텍스트로 처리
              const toc = this.parseTableOfContentsText(response.text);
              if (toc && this.isValidTableOfContentsStrict(toc)) {
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
   * 방법 3: 강화된 메타데이터 추출
   */
  private async extractFromEnhancedMetadata(book: Book): Promise<TOCExtractionResult> {
    const startTime = Date.now();

    if (!book.controlNo) {
      return this.createFailResult('EnhancedMetadata', 'controlNo가 필요합니다', startTime);
    }

    try {
      const detailUrl = `${this.baseUrl}/NL/contents/detail.do?viewKey=${book.controlNo}`;
      const response = await this.makeRequest(detailUrl);

      if (!response.text) {
        return this.createFailResult('EnhancedMetadata', '응답이 비어있습니다', startTime);
      }

      // 더 정확한 메타데이터 패턴들
      const enhancedMetaPatterns = [
        // JSON-LD 구조화된 데이터
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
        
        // 목차 전용 메타 태그
        /<meta[^>]*name="(?:toc|tableOfContents|contents)"[^>]*content="([^"]*)"[^>]*>/gi,
        
        // 상세 정보 메타 태그
        /<meta[^>]*property="book:(?:structure|outline|contents)"[^>]*content="([^"]*)"[^>]*>/gi,
        
        // 숨겨진 데이터 속성
        /<[^>]*data-toc="([^"]*)"[^>]*>/gi,
        /<[^>]*data-contents="([^"]*)"[^>]*>/gi
      ];

      for (const pattern of enhancedMetaPatterns) {
        const matches = [...response.text.matchAll(pattern)];
        for (const match of matches) {
          let content;
          
          if (pattern.source.includes('ld+json')) {
            // JSON-LD 처리
            try {
              const jsonData = JSON.parse(match[1]);
              content = this.extractTOCFromJSON(jsonData);
            } catch {
              continue;
            }
          } else {
            // 일반 메타데이터 처리
            content = this.decodeHTMLEntities(match[1]);
            content = this.parseTableOfContentsText(content);
          }

          if (content && this.isValidTableOfContentsStrict(content)) {
            const confidence = this.calculateConfidence(content, 'enhanced-metadata');
            return {
              success: true,
              content,
              method: 'EnhancedMetadata',
              confidence,
              responseTime: Date.now() - startTime,
              metadata: {
                source: detailUrl,
                patterns: ['enhanced-meta-tags'],
                validationScore: confidence
              }
            };
          }
        }
      }

      return this.createFailResult('EnhancedMetadata', '강화된 메타데이터에서 목차를 찾을 수 없습니다', startTime);

    } catch (error) {
      return this.createFailResult('EnhancedMetadata', `오류: ${error.message}`, startTime);
    }
  }

  /**
   * 방법 4: 제한적 폴백 (기존 로직을 안전하게 축소)
   */
  private async extractFromLimitedFallback(book: Book): Promise<TOCExtractionResult> {
    const startTime = Date.now();

    if (!book.controlNo) {
      return this.createFailResult('LimitedFallback', 'controlNo가 필요합니다', startTime);
    }

    try {
      // 검증된 URL 패턴만 사용 (3개로 제한)
      const limitedUrlPatterns = [
        `${this.baseUrl}/NL/contents/detail.do?viewKey=${book.controlNo}&section=toc`,
        `${this.baseUrl}/NL/contents/search.do?viewKey=${book.controlNo}&viewType=AH1&tab=toc`,
        `${this.baseUrl}/library/detail/${book.controlNo}`
      ];

      for (const url of limitedUrlPatterns) {
        try {
          const response = await this.makeRequest(url);

          if (response.text) {
            const toc = this.extractTOCFromDetailPageHTML(response.text, book.controlNo, book.title);
            if (toc && this.isValidTableOfContentsStrict(toc)) {
              const confidence = this.calculateConfidence(toc, 'limited-fallback');
              return {
                success: true,
                content: toc,
                method: 'LimitedFallback',
                confidence,
                responseTime: Date.now() - startTime,
                metadata: {
                  source: url,
                  patterns: ['limited-url-pattern'],
                  validationScore: confidence
                }
              };
            }
          }
        } catch (urlError) {
          this.log('warn', `제한적 폴백 URL 실패: ${url}`, urlError);
        }
      }

      return this.createFailResult('LimitedFallback', '제한적 폴백에서 목차를 찾을 수 없습니다', startTime);

    } catch (error) {
      return this.createFailResult('LimitedFallback', `오류: ${error.message}`, startTime);
    }
  }

  /**
   * JSON 데이터에서 목차 추출 (기존 로직 유지)
   */
  private extractTOCFromJSON(data: any): string | null {
    const tocFields = [
      'tableOfContents', 'toc', 'contents', 'outline', 'structure',
      'summary', 'description', 'chapters', 'sections', 'index'
    ];

    const searchInObject = (obj: any, depth = 0): string | null => {
      if (depth > 5 || !obj || typeof obj !== 'object') return null;

      for (const field of tocFields) {
        if (obj[field] && typeof obj[field] === 'string') {
          const toc = this.parseTableOfContentsText(obj[field]);
          if (toc && this.isValidTableOfContentsStrict(toc)) {
            return toc;
          }
        }
      }

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
   * HTML에서 상세 목차 추출 (기존 로직 개선)
   */
  private extractTOCFromDetailPageHTML(html: string, controlNo: string, bookTitle: string): string {
    const tocPatterns = [
      /<table[^>]*(?:class|id)="[^"]*(?:toc|목차|contents)[^"]*"[^>]*>([\s\S]{100,3000}?)<\/table>/gi,
      /<div[^>]*(?:class|id)="[^"]*(?:toc|목차|contents)[^"]*"[^>]*>([\s\S]{100,3000}?)<\/div>/gi,
      /<(?:ul|ol)[^>]*(?:class|id)="[^"]*(?:toc|목차|contents)[^"]*"[^>]*>([\s\S]{100,3000}?)<\/(?:ul|ol)>/gi,
      /<tr[^>]*>[\s\S]*?<(?:th|td)[^>]*>[\s]*(?:목차|차례|Contents)[\s]*<\/(?:th|td)>[\s]*<(?:th|td)[^>]*>([\s\S]{100,3000}?)<\/(?:th|td)>[\s\S]*?<\/tr>/gi
    ];

    for (const pattern of tocPatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        const rawContent = match[1];
        const toc = this.parseTableOfContentsText(rawContent);

        if (toc && this.isValidTableOfContentsStrict(toc)) {
          return toc;
        }
      }
    }

    return '';
  }

  /**
   * HTML 텍스트를 목차 형태로 파싱 (기존 로직 개선)
   */
  private parseTableOfContentsText(htmlText: string): string {
    if (!htmlText) return '';

    try {
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
          if (line.length < 3 || line.length > 200) return false;
          if (/^(목차|차례|contents|table|index)$/i.test(line)) return false;
          if (/^(page|페이지|\d+\s*$)/.test(line)) return false;

          const tocPatterns = [
            /^\d+[.\s-]/,
            /^제\s*\d+[장절편부]/,
            /^\d+장\s/,
            /^[가-힣]\s*[.\s]/,
            /^[IVX]+[.\s]/i,
            /^[부록|참고문헌|색인]/,
            /^들어가는\s*글|나가는\s*글/,
            /=\s*\d+\s*$/,
            /^[\d\.]+\s+[가-힣]/
          ];

          return tocPatterns.some(pattern => pattern.test(line));
        })
        .slice(0, 50); // 최대 50개 항목으로 제한

      return lines.join('\n');

    } catch (error) {
      this.log('error', 'HTML 텍스트 파싱 오류:', error);
      return '';
    }
  }

  /**
   * 목차 내용의 신뢰도 계산 (개선됨)
   */
  private calculateConfidence(toc: string, method: string): number {
    let confidence = 0.4; // 기본 신뢰도 낮춤

    const lines = toc.split('\n').filter(line => line.trim().length > 0);

    // 라인 수에 따른 가산점
    if (lines.length >= 15) confidence += 0.25;
    else if (lines.length >= 8) confidence += 0.15;
    else if (lines.length >= 5) confidence += 0.1;

    // 목차 패턴 다양성 (더 엄격)
    const patterns = [
      /^\d+[.\s-]/,
      /^제\s*\d+[장절]/,
      /^[가-힣]\s*[.\s]/,
      /=\s*\d+\s*$/,
      /들어가는\s*글|나가는\s*글/
    ];

    const matchedPatterns = patterns.filter(pattern =>
      lines.some(line => pattern.test(line))
    );

    confidence += matchedPatterns.length * 0.08;

    // 방법별 가중치 (개선됨)
    const methodWeights: Record<string, number> = {
      'targeted-html': 0.3,      // 새로 추가된 가장 효과적인 방법
      'direct-api-json': 0.25,
      'enhanced-metadata': 0.2,
      'direct-api-text': 0.15,
      'limited-fallback': 0.1
    };

    confidence += methodWeights[method] || 0;

    // 품질 평가
    const avgLineLength = lines.reduce((sum, line) => sum + line.trim().length, 0) / lines.length;
    if (avgLineLength >= 15 && avgLineLength <= 40) confidence += 0.1;
    if (toc.length > 500 && toc.length < 2000) confidence += 0.1;

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * HTML 엔티티 디코딩 (기존 로직 유지)
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
   * HTML에서 텍스트만 추출 (개선됨)
   */
  private extractTextFromHTML(html: string): string {
    let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<[^>]+>/g, '');

    // HTML 엔티티 디코딩
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&apos;/g, "'");
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    text = text.replace(/&#x([a-fA-F0-9]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

    return text.trim();
  }

  /**
   * HTTP 요청 수행 (기존 로직 유지)
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
   * 실패 결과 생성 (기존 로직 유지)
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
   * 통계 기록 (기존 로직 유지)
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
   * 성공률 통계 조회 (기존 로직 유지)
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
   * 디버그 로그 (기존 로직 유지)
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.debugMode) return;

    const timestamp = new Date().toISOString();
    const prefix = `📖 [ImprovedTOCExtractor-${level.toUpperCase()}] ${timestamp}`;

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
   * 디버그 모드 설정 (기존 로직 유지)
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}