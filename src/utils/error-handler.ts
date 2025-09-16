/**
 * 사용자 친화적 오류 처리 유틸리티
 */
export interface ErrorContext {
  operation: string;
  bookTitle?: string;
  isbn?: string;
  controlNo?: string;
  method?: string;
  responseTime?: number;
}

export interface ProcessedError {
  userMessage: string;
  technicalDetails: string;
  suggestedAction: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export class ErrorHandler {
  /**
   * 오류를 사용자 친화적 메시지로 변환
   */
  static processError(error: Error | string, context: ErrorContext): ProcessedError {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'object' && error.stack ? error.stack : '';

    // 오류 유형 분석
    if (this.isNetworkError(errorMessage)) {
      return this.handleNetworkError(errorMessage, context);
    }

    if (this.isAuthError(errorMessage)) {
      return this.handleAuthError(errorMessage, context);
    }

    if (this.isAPIError(errorMessage)) {
      return this.handleAPIError(errorMessage, context);
    }

    if (this.isSessionError(errorMessage)) {
      return this.handleSessionError(errorMessage, context);
    }

    if (this.isTOCParsingError(errorMessage)) {
      return this.handleTOCParsingError(errorMessage, context);
    }

    // 일반적인 오류
    return this.handleGenericError(errorMessage, context, errorStack);
  }

  /**
   * 네트워크 오류 감지
   */
  private static isNetworkError(message: string): boolean {
    return /network|connection|timeout|net::|fetch|ENOTFOUND|ECONNREFUSED/i.test(message);
  }

  /**
   * 인증 오류 감지
   */
  private static isAuthError(message: string): boolean {
    return /unauthorized|forbidden|401|403|api.*key|authentication/i.test(message);
  }

  /**
   * API 오류 감지
   */
  private static isAPIError(message: string): boolean {
    return /api.*error|400|404|500|503|bad.*request|server.*error/i.test(message);
  }

  /**
   * 세션 오류 감지
   */
  private static isSessionError(message: string): boolean {
    return /session|cookie|csrf|referer|origin/i.test(message);
  }

  /**
   * 목차 파싱 오류 감지
   */
  private static isTOCParsingError(message: string): boolean {
    return /parse|parsing|html|extract|invalid.*content/i.test(message);
  }

  /**
   * 네트워크 오류 처리
   */
  private static handleNetworkError(message: string, context: ErrorContext): ProcessedError {
    return {
      userMessage: `네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해 주세요.`,
      technicalDetails: `Network Error in ${context.operation}: ${message}`,
      suggestedAction: '인터넷 연결을 확인하고 다시 시도해 주세요. VPN을 사용 중이라면 잘시 비활성화해 보세요.',
      severity: 'error'
    };
  }

  /**
   * 인증 오류 처리
   */
  private static handleAuthError(message: string, context: ErrorContext): ProcessedError {
    return {
      userMessage: `API 키에 문제가 있습니다. 설정에서 API 키를 확인해 주세요.`,
      technicalDetails: `Auth Error in ${context.operation}: ${message}`,
      suggestedAction: '국립중앙도서관에서 발급받은 올바른 API 키를 입력하세요. API 키가 만료되었을 가능성도 있습니다.',
      severity: 'critical'
    };
  }

  /**
   * API 오류 처리
   */
  private static handleAPIError(message: string, context: ErrorContext): ProcessedError {
    let userMessage = '국립중앙도서관 API에 일시적인 문제가 있습니다.';
    let suggestedAction = '잘시 후 다시 시도해 주세요.';
    let severity: ProcessedError['severity'] = 'warning';

    if (message.includes('404')) {
      userMessage = `"${context.bookTitle || '해당 도서'}"를 찾을 수 없습니다.`;
      suggestedAction = '도서 제목이나 저자명을 다른 방식으로 검색해 보세요.';
      severity = 'warning';
    } else if (message.includes('500') || message.includes('503')) {
      userMessage = '국립중앙도서관 서버에 문제가 있습니다.';
      suggestedAction = '서버 점검 중일 수 있습니다. 나중에 다시 시도해 주세요.';
      severity = 'error';
    }

    return {
      userMessage,
      technicalDetails: `API Error in ${context.operation}: ${message}`,
      suggestedAction,
      severity
    };
  }

  /**
   * 세션 오류 처리
   */
  private static handleSessionError(message: string, context: ErrorContext): ProcessedError {
    return {
      userMessage: '웹사이트 접속에 문제가 있습니다. 세션을 초기화하고 다시 시도합니다.',
      technicalDetails: `Session Error in ${context.operation}: ${message}`,
      suggestedAction: '플러그인을 비활성화하고 다시 활성화하거나, 브라우저 쿠키를 삭제해 보세요.',
      severity: 'warning'
    };
  }

  /**
   * 목차 파싱 오류 처리
   */
  private static handleTOCParsingError(message: string, context: ErrorContext): ProcessedError {
    return {
      userMessage: `"${context.bookTitle || '해당 도서'}" 목차 정보를 처리하는데 문제가 있습니다.`,
      technicalDetails: `TOC Parsing Error in ${context.operation}: ${message}`,
      suggestedAction: '국립중앙도서관 사이트에서 직접 목차를 확인해 주세요. 이 책에는 목차 정보가 없을 수도 있습니다.',
      severity: 'info'
    };
  }

  /**
   * 일반적인 오류 처리
   */
  private static handleGenericError(message: string, context: ErrorContext, stack?: string): ProcessedError {
    return {
      userMessage: `"${context.bookTitle || context.operation}" 처리 중 예상치 못한 문제가 발생했습니다.`,
      technicalDetails: `Generic Error in ${context.operation}: ${message}${stack ? '\nStack: ' + stack : ''}`,
      suggestedAction: '다른 도서로 시도해 보거나, 잘시 후 다시 시도해 주세요. 문제가 지속되면 GitHub에 이슈를 등록해 주세요.',
      severity: 'error'
    };
  }

  /**
   * 목차 추출 실패에 대한 사용자 친화적 메시지 생성
   */
  static generateTOCFailureMessage(
    bookTitle: string,
    errors: string[],
    methodsAttempted: string[],
    responseTime?: number
  ): string {
    let message = `📚 **"${bookTitle}"** 목차 정보\n\n`;
    
    message += `⚠️ **목차를 찾을 수 없습니다**\n\n`;
    
    if (methodsAttempted.length > 0) {
      message += `🔍 **시도한 방법:**\n`;
      methodsAttempted.forEach((method, index) => {
        message += `${index + 1}. ${this.translateMethodName(method)}\n`;
      });
      message += `\n`;
    }
    
    if (responseTime) {
      message += `⏱️ **처리 시간:** ${responseTime}ms\n\n`;
    }
    
    message += `🔗 **대안 방법:**\n`;
    message += `1. [국립중앙도서관 사이트](https://www.nl.go.kr)에서 직접 검색\n`;
    message += `2. 다른 검색어로 재시도 (예: 저자명이나 출판사명)\n`;
    message += `3. ISBN 정보로 재검색\n\n`;
    
    message += `📝 **참고 사항:**\n`;
    message += `- 모든 도서에 목차 정보가 있는 것은 아닙니다\n`;
    message += `- 서지정보가 등록되어 있지 않을 수 있습니다\n`;
    message += `- 전자책의 경우 목차 정보가 제한적일 수 있습니다\n\n`;
    
    if (errors.length > 0) {
      message += `🔧 **기술적 세부사항:**\n`;
      errors.forEach((error, index) => {
        message += `${index + 1}. ${error}\n`;
      });
    }
    
    return message;
  }

  /**
   * 방법명을 사용자 친화적 이름으로 변환
   */
  private static translateMethodName(method: string): string {
    const translations: Record<string, string> = {
      'session-book-tb-cnt-url': '세션 기반 목차 URL 접근',
      'session-detail-page': '세션 기반 상세 페이지 분석',
      'session-txt-download': '세션 기반 TXT 다운로드',
      'fallback': '기존 방식 폴백',
      'legacy-isbn': '기존 ISBN 검색',
      'legacy-general': '기존 일반 검색'
    };
    
    return translations[method] || method;
  }

  /**
   * 성공 메시지 생성
   */
  static generateSuccessMessage(
    bookTitle: string,
    method: string,
    responseTime?: number,
    tocLength?: number
  ): string {
    let message = `✅ **"${bookTitle}"** 목차 추출 성공!\n\n`;
    
    message += `🎆 **사용된 방법:** ${this.translateMethodName(method)}\n`;
    
    if (responseTime) {
      message += `⏱️ **처리 시간:** ${responseTime}ms\n`;
    }
    
    if (tocLength) {
      message += `📄 **목차 길이:** ${tocLength}글자\n`;
    }
    
    return message;
  }
}
