import { requestUrl, RequestUrlParam } from 'obsidian';

/**
 * 세션 관리자 - 국립중앙도서관 웹사이트와의 세션 유지 및 인증 처리
 */
export class SessionManager {
  private cookies: Map<string, string> = new Map();
  private userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private baseUrl = 'https://www.nl.go.kr';
  private sessionEstablished = false;
  private debugMode = true;
  
  constructor(private apiKey: string) {}

  /**
   * 디버깅 로그 출력
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    if (!this.debugMode) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `🔧 [SessionManager-${level.toUpperCase()}] ${timestamp}`;
    
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
   * 응답에서 쿠키 추출 및 저장
   */
  private extractCookiesFromResponse(response: any): void {
    const setCookieHeader = response.headers['set-cookie'];
    if (!setCookieHeader) return;

    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    
    cookies.forEach((cookie: string) => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        this.cookies.set(name.trim(), value.trim());
        this.log('info', `쿠키 저장: ${name.trim()}=${value.trim().substring(0, 20)}...`);
      }
    });
  }

  /**
   * 현재 쿠키를 헤더 문자열로 변환
   */
  private getCookieHeader(): string {
    const cookieArray: string[] = [];
    this.cookies.forEach((value, name) => {
      cookieArray.push(`${name}=${value}`);
    });
    return cookieArray.join('; ');
  }

  /**
   * 기본 HTTP 헤더 생성
   */
  private getDefaultHeaders(referrer?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': referrer ? 'same-origin' : 'none'
    };

    if (referrer) {
      headers['Referer'] = referrer;
    }

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    return headers;
  }

  /**
   * 세션 설정 - 메인 페이지 방문으로 초기 쿠키 획득
   */
  async establishSession(): Promise<boolean> {
    this.log('info', '세션 설정 시작');
    
    try {
      const mainPageUrl = `${this.baseUrl}`;
      this.log('info', `메인 페이지 방문: ${mainPageUrl}`);
      
      const response = await requestUrl({
        url: mainPageUrl,
        method: 'GET',
        headers: this.getDefaultHeaders()
      });

      if (response.status === 200) {
        this.extractCookiesFromResponse(response);
        this.sessionEstablished = true;
        this.log('info', `세션 설정 완료. 저장된 쿠키 수: ${this.cookies.size}`);
        return true;
      } else {
        this.log('error', `메인 페이지 접근 실패: HTTP ${response.status}`);
        return false;
      }
    } catch (error) {
      this.log('error', '세션 설정 중 오류 발생', error);
      return false;
    }
  }

  /**
   * 인증된 요청 수행
   */
  async makeAuthenticatedRequest(url: string, referrer?: string): Promise<any> {
    if (!this.sessionEstablished) {
      this.log('warn', '세션이 설정되지 않음. 자동으로 세션 설정 시도');
      const sessionOk = await this.establishSession();
      if (!sessionOk) {
        throw new Error('세션 설정에 실패했습니다.');
      }
    }

    this.log('info', `인증된 요청: ${url}`);
    this.log('info', `Referrer: ${referrer || 'None'}`);
    
    try {
      const headers = this.getDefaultHeaders(referrer);
      this.log('info', '요청 헤더', headers);
      
      const response = await requestUrl({
        url,
        method: 'GET',
        headers
      });

      // 새로운 쿠키가 있으면 업데이트
      this.extractCookiesFromResponse(response);

      this.log('info', `응답: HTTP ${response.status}`);
      this.log('info', `응답 크기: ${response.text?.length || 0} chars`);
      
      if (response.status === 200) {
        return response;
      } else {
        this.log('error', `HTTP 오류: ${response.status}`);
        throw new Error(`HTTP ${response.status}: 요청 실패`);
      }
    } catch (error) {
      this.log('error', '인증된 요청 실패', error);
      throw error;
    }
  }

  /**
   * 검색 페이지를 통한 도서 상세 페이지 접근
   */
  async navigateToBookDetail(controlNo: string, bookTitle: string): Promise<string> {
    this.log('info', `도서 상세 페이지 네비게이션 시작: ${controlNo}`);
    
    // 1단계: 검색 페이지 방문
    const searchUrl = `${this.baseUrl}/NL/contents/search.do`;
    const searchResponse = await this.makeAuthenticatedRequest(searchUrl, this.baseUrl);
    
    // 2단계: 검색 실행 (검색 페이지 referrer 포함)
    const searchQuery = encodeURIComponent(bookTitle);
    const searchResultUrl = `${searchUrl}?srchTarget=total&kwd=${searchQuery}`;
    const searchResultResponse = await this.makeAuthenticatedRequest(searchResultUrl, searchUrl);
    
    // 3단계: 상세 페이지 접근 (서버 렌더링 페이지 사용)
    const detailUrl = `${this.baseUrl}/NL/contents/detail.do?viewKey=${controlNo}`;
    const detailResponse = await this.makeAuthenticatedRequest(detailUrl, searchResultUrl);
    
    this.log('info', '도서 상세 페이지 네비게이션 완료');
    return detailUrl;
  }

  /**
   * 세션 상태 확인
   */
  isSessionActive(): boolean {
    return this.sessionEstablished && this.cookies.size > 0;
  }

  /**
   * 세션 초기화
   */
  resetSession(): void {
    this.cookies.clear();
    this.sessionEstablished = false;
    this.log('info', '세션이 초기화되었습니다.');
  }

  /**
   * 디버그 모드 설정
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.log('info', `디버그 모드 ${enabled ? '활성화' : '비활성화'}`);
  }

  /**
   * 세션 통계 정보
   */
  getSessionStats(): { cookieCount: number; sessionActive: boolean; userAgent: string } {
    return {
      cookieCount: this.cookies.size,
      sessionActive: this.sessionEstablished,
      userAgent: this.userAgent
    };
  }
}
