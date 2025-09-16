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

    try {
      // API 요청 파라미터 구성
      const searchParams = new URLSearchParams({
        key: this.apiKey,
        apiType: 'json',
        pageNum: params.pageNum?.toString() || '1',
        pageSize: params.pageSize?.toString() || '20'
      });

      // 검색어 타입에 따른 파라미터 추가
      if (params.query) {
        searchParams.append('kwd', params.query);
      }

      if (params.isbn) {
        searchParams.append('isbn', params.isbn);
      }

      if (params.publisher) {
        searchParams.append('pub', params.publisher);
      }

      if (params.author) {
        searchParams.append('aut', params.author);
      }

      if (params.title) {
        searchParams.append('tit', params.title);
      }

      const searchUrl = `${this.BASE_URL}${this.SEARCH_API}?${searchParams.toString()}`;
      console.log('🌐 [API] Request URL:', searchUrl);

      // HTTP 요청 실행
      const requestParam: RequestUrlParam = {
        url: searchUrl,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      };

      const response = await requestUrl(requestParam);
      console.log('📦 [API] Response status:', response.status);

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.text || 'Unknown error'}`);
      }

      // 응답 데이터 안전하게 파싱
      let responseData: any;
      try {
        // 텍스트 응답을 먼저 확인
        if (response.text) {
          const responseText = response.text.trim();

          // XML 오류 응답 처리
          if (responseText.startsWith('<error>')) {
            const msgMatch = responseText.match(/<msg>(.*?)<\/msg>/);
            const codeMatch = responseText.match(/<error_code>(.*?)<\/error_code>/);
            const errorMsg = msgMatch ? msgMatch[1] : '알 수 없는 API 오류';
            const errorCode = codeMatch ? codeMatch[1] : '000';

            if (errorCode === '011' || errorMsg.includes('인증키값이 유효하지 않습니다')) {
              throw new Error('❌ API 키가 유효하지 않습니다.\n\n설정에서 올바른 국립중앙도서관 Open API 키를 입력해주세요.\nAPI 키는 https://www.nl.go.kr/NL/contents/N31101030700.do 에서 발급받을 수 있습니다.');
            } else {
              throw new Error(`❌ API 오류 (${errorCode}): ${errorMsg}`);
            }
          }

          // HTML 응답 처리
          if (responseText.startsWith('<html') || responseText.startsWith('<!DOCTYPE')) {
            throw new Error('❌ API에서 HTML 페이지를 반환했습니다.\n\nAPI 키나 API 엔드포인트를 확인해주세요.');
          }

          // 기타 XML 응답 처리
          if (responseText.startsWith('<')) {
            throw new Error('❌ API에서 예상하지 못한 XML 응답을 반환했습니다.\n\nAPI 설정을 확인해주세요.');
          }

          responseData = JSON.parse(response.text);
        } else if (response.json && typeof response.json === 'object') {
          responseData = response.json;
        } else {
          throw new Error('빈 응답을 받았습니다.');
        }
      } catch (parseError: any) {
        // 이미 우리가 던진 오류라면 다시 던지기
        if (parseError.message.startsWith('❌')) {
          throw parseError;
        }

        console.error('❌ [API] Response parsing failed:', parseError);
        console.log('📄 [API] Raw response text:', response.text?.substring(0, 500) + '...');
        throw new Error(`❌ API 응답 파싱 실패: ${parseError.message}\n\nAPI 키와 설정을 확인해주세요.`);
      }

      console.log('📊 [API] Response data structure:', Object.keys(responseData || {}));

      // 결과 파싱
      const books = this.parseResponse(responseData);
      console.log(`✅ [API] Parsed ${books.length} books:`, books);

      console.log('ℹ️ [API] Search completed successfully');
      return books;

    } catch (error: any) {
      console.error('❌ [API] Search failed:', error);
      if (error.message?.includes('CORS')) {
        throw new Error('CORS 오류입니다. API 설정을 확인해주세요.');
      }
      throw error;
    }
  }

  /**
   * 응답 파싱 - 국립중앙도서관 API 공식 응답 구조 기준
   */
  private parseResponse(data: any): Book[] {
    console.log('🔍 [Parse] Starting to parse response');

    if (!data) {
      console.log('❌ [Parse] No data');
      return [];
    }

    // API 오류 응답 확인 (errorCode 먼저 체크)
    if (data.errorCode) {
      const errorMsg = this.getErrorMessage(data.errorCode);
      console.error('❌ [Parse] API Error Code:', data.errorCode, errorMsg);
      throw new Error(errorMsg);
    }

    if (data.error || data.Error) {
      const errorMsg = data.error || data.Error || '알 수 없는 API 오류';
      console.error('❌ [Parse] API Error:', errorMsg);
      throw new Error(`API 오류: ${errorMsg}`);
    }

    // 응답 구조 분석 - 국립중앙도서관 API 공식 구조
    let resultArray: any[] = [];

    // 국립중앙도서관 API 응답 구조: title_info 배열 확인
    if (data.title_info && Array.isArray(data.title_info)) {
      resultArray = data.title_info;
      console.log(`✅ [Parse] Found ${resultArray.length} items in data.title_info`);
    } else if (data.result && Array.isArray(data.result)) {
      resultArray = data.result;
      console.log(`✅ [Parse] Found ${resultArray.length} items in data.result`);
    } else if (data.docs && Array.isArray(data.docs)) {
      resultArray = data.docs;
      console.log(`✅ [Parse] Found ${resultArray.length} items in data.docs`);
    } else if (Array.isArray(data)) {
      resultArray = data;
      console.log(`✅ [Parse] Found ${resultArray.length} items in root array`);
    } else {
      console.log('🔍 [Parse] Exploring data structure:', Object.keys(data));

      // 다른 가능한 구조들 탐색
      for (const key of Object.keys(data)) {
        const value = data[key];
        if (Array.isArray(value)) {
          console.log(`🎯 [Parse] Found array in ${key}: ${value.length} items`);
          resultArray = value;
          break;
        }
      }

      if (resultArray.length === 0) {
        console.log('❌ [Parse] No valid array found in response');
        console.log('📄 [Parse] Full response structure:', JSON.stringify(data, null, 2).substring(0, 500));
        return [];
      }
    }

    const books: Book[] = [];

    for (let i = 0; i < resultArray.length; i++) {
      const item = resultArray[i];
      console.log(`📖 [Parse] Processing item ${i + 1}:`, Object.keys(item));

      // CONTROL_NO 추출 (여러 가능한 필드명 확인)
      const controlNo = this.extractField(item, ['CONTROL_NO', 'controlNo', 'control_no', 'id', 'bookId']);

      try {
        const book: Book = {
          title: this.cleanText(this.extractField(item, ['TITLE', 'title', 'title_info', 'titleInfo', 'book_title'])),
          author: this.cleanText(this.extractField(item, ['AUTHOR', 'author', 'author_info', 'authorInfo', 'book_author'])),
          publisher: this.cleanText(this.extractField(item, ['PUBLISHER', 'publisher', 'pub_info', 'pubInfo'])),
          publishDate: this.cleanText(this.extractField(item, ['PUBLISH_DATE', 'PUBLISH_YEAR', 'publish_date', 'publish_year', 'pub_year', 'pubDate'])),
          isbn: this.cleanText(this.extractField(item, ['ISBN', 'isbn', 'isbn13', 'ISBN13'])),
          pages: this.cleanText(this.extractField(item, ['PAGE', 'pages', 'page_info', 'pageInfo', 'extent'])),
          price: this.cleanText(this.extractField(item, ['PRICE', 'price'])),
          callNumber: this.cleanText(this.extractField(item, ['CALL_NO', 'call_no', 'callNumber', 'call_number'])),
          kdc: this.cleanText(this.extractField(item, ['KDC', 'kdc'])),
          ddc: this.cleanText(this.extractField(item, ['DDC', 'ddc'])),
          size: this.cleanText(this.extractField(item, ['SIZE', 'size'])),
          detailLink: this.cleanText(this.extractField(item, ['detailLink', 'detail_link'])),
          subject: this.cleanText(this.extractField(item, ['typeName', 'type_name', 'subject', 'SUBJECT'])),
          ebook: this.extractField(item, ['mediaName']) === '전자책' ||
                 this.extractField(item, ['media_name']) === '전자책' ||
                 this.extractField(item, ['EBOOK_YN']) === 'Y',
          coverImage: this.cleanText(this.extractField(item, ['imageUrl', 'title_url', 'TITLE_URL', 'coverImage'])),
          controlNo: controlNo // 추출된 CONTROL_NO 저장
        };

        books.push(book);
      } catch (error) {
        console.error(`❌ [Parse] Failed to parse item ${i + 1}:`, error);
        console.log('🔍 [Parse] Problem item:', item);
      }
    }

    console.log(`✅ [Parse] Successfully parsed ${books.length} books`);
    return books;
  }

  /**
   * 여러 필드명에서 값 추출 (유연한 매핑)
   */
  private extractField(item: any, fieldNames: string[]): string {
    for (const fieldName of fieldNames) {
      if (item[fieldName] !== undefined && item[fieldName] !== null && item[fieldName] !== '') {
        return String(item[fieldName]);
      }
    }
    return '';
  }

  /**
   * 텍스트 정리 (HTML 태그 제거, 공백 정리)
   */
  private cleanText(text: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '') // HTML 태그 제거
      .replace(/&nbsp;/g, ' ') // &nbsp; 공백 변환
      .replace(/&amp;/g, '&') // HTML 엔티티 변환
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // 연속 공백을 하나로
      .trim();
  }

  /**
   * API 오류 코드에 따른 사용자 친화적 메시지 반환
   */
  private getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      '000': '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      '010': 'API 키가 제공되지 않았습니다. 설정을 확인해주세요.',
      '011': '❌ API 키가 유효하지 않습니다.\n\n설정에서 올바른 국립중앙도서관 Open API 키를 입력해주세요.\nAPI 키는 https://www.nl.go.kr/NL/contents/N31101030700.do 에서 발급받을 수 있습니다.',
      '020': '검색 키워드가 제공되지 않았습니다.',
      '030': '요청된 페이지 번호가 잘못되었습니다.',
      '040': '페이지 크기가 허용 범위를 벗어났습니다.',
      '050': '검색 결과가 없습니다.',
      '999': '알 수 없는 오류가 발생했습니다.'
    };

    const message = errorMessages[errorCode];
    return message || `API 오류 (코드: ${errorCode}) - 관리자에게 문의해주세요.`;
  }
}