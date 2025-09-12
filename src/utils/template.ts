import { Book } from '../api/types';

export class BookNoteTemplate {
  /**
   * 템플릿 변수를 실제 값으로 치환
   */
  static render(template: string, book: Book): string {
    // Handlebars 스타일의 조건문 처리
    let rendered = template;
    
    // if-else 조건문 처리
    rendered = this.processConditionals(rendered, book);
    
    // 기본 변수 치환
    const variables: Record<string, any> = {
      title: book.title || '',
      author: book.author || '',
      publisher: book.publisher || '',
      publishDate: book.publishDate || '',
      isbn: book.isbn || '',
      pages: book.pages || '',
      price: book.price || '',
      subject: book.subject || '',
      kdc: book.kdc || '',
      ddc: book.ddc || '',
      callNumber: book.callNumber || '',
      series: book.series || '',
      volume: book.volume || '',
      edition: book.edition || '',
      summary: book.summary || '',
      tableOfContents: book.tableOfContents || '',
      detailLink: book.detailLink || '',
      coverImage: book.coverImage || '',
      ebook: book.ebook,
      date: window.moment().format('YYYY-MM-DD'),
      datetime: window.moment().format('YYYY-MM-DD HH:mm:ss'),
      year: window.moment().format('YYYY'),
      month: window.moment().format('MM'),
      day: window.moment().format('DD')
    };

    // 변수 치환
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, value.toString());
    });

    // 빈 변수 정리
    rendered = rendered.replace(/{{[^}]+}}/g, '');
    
    return rendered;
  }

  /**
   * 조건문 처리
   */
  private static processConditionals(template: string, book: Book): string {
    let result = template;

    // {{#if variable}}...{{/if}} 처리
    const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    result = result.replace(ifRegex, (match, variable, content) => {
      const value = (book as any)[variable];
      if (value && value !== '') {
        return content;
      }
      return '';
    });

    // {{#if variable}}...{{else}}...{{/if}} 처리
    const ifElseRegex = /{{#if\s+(\w+)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g;
    result = result.replace(ifElseRegex, (match, variable, ifContent, elseContent) => {
      const value = (book as any)[variable];
      if (value && value !== '') {
        return ifContent;
      }
      return elseContent;
    });

    return result;
  }

  /**
   * 파일명 생성
   */
  static generateFileName(template: string, book: Book): string {
    let fileName = this.render(template, book);
    
    // 파일명에 사용할 수 없는 문자 제거
    fileName = fileName
      .replace(/[\\/:*?"<>|]/g, '-')  // 특수문자를 하이픈으로 치환
      .replace(/\s+/g, ' ')            // 연속된 공백 제거
      .trim();                         // 앞뒤 공백 제거
    
    // 파일명이 비어있는 경우 기본값 사용
    if (!fileName) {
      fileName = `Book_${window.moment().format('YYYYMMDD_HHmmss')}`;
    }
    
    // 파일명 길이 제한 (최대 255자)
    if (fileName.length > 200) {
      fileName = fileName.substring(0, 200);
    }
    
    return fileName;
  }

  /**
   * 폴더 경로 정리
   */
  static normalizeFolderPath(path: string): string {
    if (!path) return '';
    
    // 경로 정리
    path = path
      .replace(/\\/g, '/')      // 백슬래시를 슬래시로
      .replace(/\/+/g, '/')     // 연속된 슬래시 제거
      .replace(/^\/+|\/+$/g, ''); // 앞뒤 슬래시 제거
    
    return path;
  }

  /**
   * 날짜 포맷
   */
  static formatDate(dateString: string, format = 'YYYY-MM-DD'): string {
    if (!dateString) return '';
    
    // YYYYMMDD 형식을 YYYY-MM-DD로 변환
    if (/^\d{8}$/.test(dateString)) {
      dateString = dateString.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    }
    
    const date = window.moment(dateString);
    if (date.isValid()) {
      return date.format(format);
    }
    
    return dateString;
  }

  /**
   * 가격 포맷
   */
  static formatPrice(price: string | undefined): string {
    if (!price) return '';
    
    // 숫자만 추출
    const numericPrice = price.replace(/[^\d]/g, '');
    if (!numericPrice) return price;
    
    // 천 단위 콤마 추가
    const formatted = parseInt(numericPrice).toLocaleString('ko-KR');
    return `${formatted}원`;
  }
}
