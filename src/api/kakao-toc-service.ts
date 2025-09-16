import { requestUrl, RequestUrlParam } from 'obsidian';
import { KakaoTOCResult, KakaoBookDocument } from '../types/kakao-types';

/**
 * 카카오 도서 목차 크롤링 서비스
 *
 * 참고: Obsidian 플러그인 환경에서는 Selenium/Puppeteer를 사용할 수 없으므로
 * requestUrl로 HTML을 직접 가져온 후 파싱하는 방식을 사용합니다.
 */
export class KakaoTOCService {
  private debugMode = true;
  private readonly maxRetries = 3;
  private readonly timeout = 10000;

  constructor() {}

  /**
   * 디버깅 로그 출력
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    if (!this.debugMode) return;

    const timestamp = new Date().toISOString();
    const prefix = `📚 [KakaoTOC-${level.toUpperCase()}] ${timestamp}`;

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
   * 카카오 도서 상세 페이지에서 목차 추출
   */
  async extractTableOfContents(kakaoBook: KakaoBookDocument): Promise<KakaoTOCResult> {
    if (!kakaoBook.url) {
      return {
        success: false,
        error: '카카오 도서 URL이 없습니다.',
        source: 'fallback'
      };
    }

    this.log('info', `목차 추출 시작: ${kakaoBook.title}`, { url: kakaoBook.url });

    try {
      // 다음 검색 결과 페이지로 이동하여 목차 정보 추출
      const detailUrl = this.convertToDetailPageUrl(kakaoBook.url);
      this.log('info', `상세 페이지 URL: ${detailUrl}`);

      const tocContent = await this.fetchTableOfContentsFromDetailPage(detailUrl);

      if (tocContent) {
        return {
          success: true,
          content: tocContent,
          source: 'detail-page',
          kakaoUrl: detailUrl
        };
      } else {
        return {
          success: false,
          error: '목차 정보를 찾을 수 없습니다.',
          source: 'fallback',
          kakaoUrl: detailUrl
        };
      }

    } catch (error) {
      this.log('error', '목차 추출 중 오류 발생', error);
      return {
        success: false,
        error: `목차 추출 오류: ${error.message}`,
        source: 'fallback'
      };
    }
  }

  /**
   * 카카오 검색 결과 URL을 상세 페이지 URL로 변환
   */
  private convertToDetailPageUrl(searchUrl: string): string {
    // 카카오 검색 결과 URL에서 bookId 추출
    const urlParams = new URLSearchParams(searchUrl.split('?')[1]);
    const bookId = urlParams.get('bookId') || this.extractBookIdFromUrl(searchUrl);

    if (bookId) {
      // 다음 도서 상세 페이지 URL 생성 (목차 정보가 포함된 페이지)
      return `https://search.daum.net/search?w=bookpage&bookId=${bookId}`;
    }

    return searchUrl;
  }

  /**
   * URL에서 bookId 추출 (정규식 사용)
   */
  private extractBookIdFromUrl(url: string): string | null {
    const bookIdMatch = url.match(/bookId=([^&]+)/);
    return bookIdMatch ? bookIdMatch[1] : null;
  }

  /**
   * 상세 페이지에서 목차 정보 추출
   */
  private async fetchTableOfContentsFromDetailPage(url: string): Promise<string | null> {
    try {
      this.log('info', '상세 페이지 HTML 가져오기 시작', { url });

      const requestConfig: RequestUrlParam = {
        url,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      };

      const response = await requestUrl(requestConfig);

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: 요청 실패`);
      }

      const html = response.text;
      this.log('info', 'HTML 가져오기 성공', { length: html.length });

      // HTML에서 목차 정보 추출
      return this.parseTableOfContentsFromHTML(html);

    } catch (error) {
      this.log('error', '상세 페이지 요청 실패', error);
      return null;
    }
  }

  /**
   * HTML에서 목차 정보 파싱
   * 참고 코드의 선택자를 기반으로 구현: #tabContent > div:nth-child(1) > div:nth-child(5)
   */
  private parseTableOfContentsFromHTML(html: string): string | null {
    try {
      this.log('info', 'HTML 파싱 시작');

      let tocContent = null;

      // 1. 정확한 tabContent 패턴 매칭 (더 포괄적인 패턴)
      const tabContentPatterns = [
        // 기본 tabContent 패턴
        /<div[^>]*id=['"]tabContent['"][^>]*>([\s\S]*?)<\/div>/i,
        // 네스티드 구조 고려
        /<div[^>]*id=['"]tabContent['"][^>]*>([\s\S]*)/i
      ];

      let tabContentHtml = null;
      for (const pattern of tabContentPatterns) {
        const match = html.match(pattern);
        if (match) {
          tabContentHtml = match[1];
          this.log('info', 'tabContent 영역 발견', { length: tabContentHtml.length });
          break;
        }
      }

      if (tabContentHtml) {
        // 2. tabContent 내에서 div 구조 분석 (nth-child(1) > nth-child(5) 시뮬레이션)
        // 첫 번째 자식 div를 찾고, 그 안에서 5번째 div를 찾기
        const firstChildDivMatch = tabContentHtml.match(/<div[^>]*>([\s\S]*?)<\/div>/i);
        if (firstChildDivMatch) {
          const firstChildContent = firstChildDivMatch[1];
          this.log('info', '첫 번째 자식 div 발견');

          // 첫 번째 자식 div 내의 모든 div들을 찾기
          const allDivsInFirst = firstChildContent.match(/<div[^>]*>[\s\S]*?<\/div>/gi);
          if (allDivsInFirst && allDivsInFirst.length >= 5) {
            // 5번째 div (인덱스 4) 추출
            const fifthDiv = allDivsInFirst[4];
            this.log('info', '5번째 div 발견', { content: fifthDiv.substring(0, 100) + '...' });

            const tocCandidate = this.extractPotentialTOC(fifthDiv);
            if (tocCandidate && this.isValidTOC(tocCandidate)) {
              tocContent = tocCandidate;
              this.log('info', '5번째 div에서 목차 발견');
            }
          }

          // 5번째 div에서 찾지 못한 경우 모든 div 검사
          if (!tocContent && allDivsInFirst) {
            this.log('info', `첫 번째 자식 div 내 총 ${allDivsInFirst.length}개 div 검사`);
            for (let i = 0; i < allDivsInFirst.length; i++) {
              const divContent = allDivsInFirst[i];
              const tocCandidate = this.extractPotentialTOC(divContent);

              if (tocCandidate && this.isValidTOC(tocCandidate)) {
                tocContent = tocCandidate;
                this.log('info', `목차 섹션 발견 (div ${i + 1})`, { length: tocCandidate.length });
                break;
              }
            }
          }
        }
      }

      // 3. tabContent에서 찾지 못한 경우에만 제한적 폴백 검색
      if (!tocContent) {
        this.log('warn', 'tabContent에서 목차를 찾지 못함, 제한적 폴백 검색');

        // 매우 구체적인 목차 패턴만 검색 (책 소개 제외)
        const strictTocPatterns = [
          // 목차 헤더가 명확하게 있는 경우만
          /목차\s*<\/[^>]*>\s*<[^>]*>[\s\S]{50,800}/gi,
          // 차례 헤더가 있는 경우
          /차례\s*<\/[^>]*>\s*<[^>]*>[\s\S]{50,800}/gi,
          // 다양한 장/부 구조가 포함된 패턴
          /(?:제?\s*\d+\s*[장부절편][\s\S]{10,50}){3,}/gi
        ];

        for (const pattern of strictTocPatterns) {
          const matches = html.match(pattern);
          if (matches) {
            for (const match of matches) {
              const cleanedText = this.extractTextFromHTML(match);
              if (this.isValidTOC(cleanedText)) {
                tocContent = cleanedText;
                this.log('info', '엄격한 패턴으로 목차 발견');
                break;
              }
            }
            if (tocContent) break;
          }
        }
      }

      if (!tocContent) {
        this.log('warn', '목차 섹션을 찾을 수 없습니다');
        return null;
      }

      // 4. 목차 텍스트 정리
      const cleanedToc = this.cleanTableOfContentsText(tocContent);

      if (cleanedToc && cleanedToc.length > 20) {
        this.log('info', '목차 추출 성공', { length: cleanedToc.length });
        return cleanedToc;
      } else {
        this.log('warn', '유효한 목차 내용을 찾을 수 없습니다');
        return null;
      }

    } catch (error) {
      this.log('error', 'HTML 파싱 중 오류', error);
      return null;
    }
  }

  /**
   * div 내용에서 잠재적인 목차 추출
   */
  private extractPotentialTOC(divHtml: string): string | null {
    // p 태그들 추출 (참고 코드에서 p 태그를 대상으로 함)
    const pTagMatches = divHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (pTagMatches && pTagMatches.length > 0) {
      const lines: string[] = [];

      for (const pTag of pTagMatches) {
        const textContent = this.extractTextFromHTML(pTag);
        if (textContent && textContent.trim().length > 0) {
          lines.push(textContent.trim());
        }
      }

      if (lines.length > 0) {
        return lines.join('\n');
      }
    }

    // p 태그가 없는 경우 전체 텍스트 추출
    return this.extractTextFromHTML(divHtml);
  }

  /**
   * 추출된 텍스트가 유효한 목차인지 검증
   */
  private isValidTOC(text: string): boolean {
    if (!text || text.length < 20) {
      this.log('warn', 'TOC 검증 실패: 텍스트가 너무 짧음', { length: text?.length || 0 });
      return false;
    }

    const cleanText = text.trim();
    const lowerText = cleanText.toLowerCase();

    // 1. 명백한 책 소개/설명문 패턴 제외 (더 강화된 필터)
    const invalidPatterns = [
      // "생각 망치" 책 소개 특정 패턴
      /[''""]산만하다[''""]|[''""]충동적이다[''""]|[''""]끈기가 부족하다[''"']/,
      /일반적으로 많은 이가 단점이라/,
      /정말 그럴까\?|하지만 정말/,
      /통념을 정면으로|주목받는 사업가/,
      /일본 사회에 큰 반향|파격적 행보/,

      // 일반적인 책 소개 패턴
      /이 책은|이번 책에서|저자는|책에서는/,
      /독자들에게|우리에게|여러분에게/,
      /\?\s*[가-힣\s]{20,}/,  // 물음문으로 시작하는 긴 설명
      /하지만|그러나|그런데\s+[가-힣\s]{30,}/,  // 접속사로 시작하는 긴 설명

      // 광고성/상품 정보
      /구매하기|장바구니|북마크|공유하기/,
      /가격|할인|이벤트|특가|세일/,
      /출판사\s*제공|저작권|copyr/i,

      // 서술형 문장 패턴 (목차가 아닌 설명문)
      /^[가-힣\s]{100,}$/,  // 100자 이상의 긴 한글 문장
      /입니다\.|습니다\.|됩니다\.|했습니다\./,  // 정중한 서술체
      /것이다\.|것입니다\.|것이며|한다\./,  // 서술형 어미
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(cleanText)) {
        this.log('warn', 'TOC 검증 실패: 책 소개/설명문 패턴 감지', {
          pattern: pattern.source.substring(0, 50) + '...',
          matched: cleanText.substring(0, 100) + '...'
        });
        return false;
      }
    }

    // 2. 확실한 목차 패턴 확인
    const strongTocPatterns = [
      /(?:제\s*)?\d+\s*[장부절편권화]/,  // "제1장", "2부", "3절" 등
      /chapter\s*\d+|part\s*\d+/i,
      /\d+\.\s*[가-힣]/,  // "1. 제목" 형태
      /\d+\)\s*[가-힣]/,  // "1) 제목" 형태
      /^[IVX]+\.\s*[가-힣]/m,  // 로마숫자 "I. 제목"
    ];

    let hasStrongPattern = false;
    for (const pattern of strongTocPatterns) {
      if (pattern.test(cleanText)) {
        hasStrongPattern = true;
        this.log('info', 'TOC 검증: 강한 목차 패턴 발견', { pattern: pattern.source });
        break;
      }
    }

    // 3. 구조적 목차 패턴 확인
    const lines = cleanText.split(/\n+/).filter(line => line.trim().length > 0);

    if (lines.length < 3) {
      this.log('warn', 'TOC 검증 실패: 줄 수가 부족함', { lineCount: lines.length });
      return false;
    }

    // 각 줄의 길이가 적절한지 확인 (목차는 보통 짧은 제목들)
    const avgLineLength = lines.reduce((sum, line) => sum + line.trim().length, 0) / lines.length;
    const maxLineLength = Math.max(...lines.map(line => line.trim().length));

    this.log('info', 'TOC 구조 분석', {
      lineCount: lines.length,
      avgLineLength: avgLineLength.toFixed(1),
      maxLineLength,
      hasStrongPattern
    });

    // 4. 최종 판정
    if (hasStrongPattern) {
      // 강한 목차 패턴이 있으면 통과
      return true;
    }

    // 강한 패턴이 없으면 구조적 특성으로 판단
    if (lines.length >= 5 && avgLineLength >= 5 && avgLineLength <= 50 && maxLineLength <= 100) {
      this.log('info', 'TOC 검증 성공: 구조적 특성으로 목차 판정');
      return true;
    }

    this.log('warn', 'TOC 검증 실패: 목차 패턴 또는 구조를 찾을 수 없음');
    return false;
  }

  /**
   * HTML에서 텍스트만 추출
   */
  private extractTextFromHTML(html: string): string {
    // HTML 태그 제거
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

    return text;
  }

  /**
   * 목차 텍스트 정리
   */
  private cleanTableOfContentsText(text: string): string {
    // 여러 공백을 하나로 통합
    text = text.replace(/\s+/g, ' ');

    // 앞뒤 공백 제거
    text = text.trim();

    // 목차와 관련 없는 텍스트 제거
    const unwantedPatterns = [
      /더보기/gi,
      /접기/gi,
      /구매하기/gi,
      /장바구니/gi,
      /북마크/gi,
      /공유하기/gi,
      /출판사 제공/gi,
      /\d+원/gi // 가격 정보
    ];

    for (const pattern of unwantedPatterns) {
      text = text.replace(pattern, '');
    }

    // 줄바꿈 정리
    text = text.replace(/\n\s*\n/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  }

  /**
   * URL 유효성 검사
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}