import { Plugin, Notice } from 'obsidian';
import { NationalLibraryAPI } from '../api/nlk-api';

/**
 * API 테스트 및 디버깅을 위한 명령어 추가
 * main.ts의 onload() 메서드에 추가할 수 있는 디버그 명령어들
 */
export function registerDebugCommands(plugin: Plugin, apiKey: string) {
  // API 연결 테스트
  plugin.addCommand({
    id: 'test-api-connection',
    name: '[Debug] API 연결 테스트',
    callback: async () => {
      const api = new NationalLibraryAPI(apiKey);
      console.log('API 연결 테스트 시작...');
      
      try {
        const result = await api.searchBooks({ 
          query: '테스트', 
          pageNum: 1, 
          pageSize: 1 
        });
        console.log('API 연결 성공:', result);
        new Notice('API 연결 성공!');
      } catch (error) {
        console.error('API 연결 실패:', error);
        new Notice('API 연결 실패. 콘솔을 확인하세요.');
      }
    }
  });

  // ISBN 검색 테스트
  plugin.addCommand({
    id: 'test-isbn-search',
    name: '[Debug] ISBN 검색 테스트',
    callback: async () => {
      const api = new NationalLibraryAPI(apiKey);
      const testISBN = '9788936433598'; // 테스트용 ISBN
      
      console.log(`ISBN ${testISBN} 검색 중...`);
      
      try {
        const book = await api.searchByISBN(testISBN);
        if (book) {
          console.log('ISBN 검색 성공:', book);
          new Notice(`도서 발견: ${book.title}`);
        } else {
          console.log('도서를 찾을 수 없음');
          new Notice('도서를 찾을 수 없습니다.');
        }
      } catch (error) {
        console.error('ISBN 검색 실패:', error);
        new Notice('ISBN 검색 실패. 콘솔을 확인하세요.');
      }
    }
  });

  // 상세 검색 테스트
  plugin.addCommand({
    id: 'test-detailed-search',
    name: '[Debug] 상세 검색 테스트',
    callback: async () => {
      const api = new NationalLibraryAPI(apiKey);
      
      console.log('상세 검색 테스트...');
      
      try {
        // 제목과 저자로 검색
        const result = await api.searchBooks({
          title: '토지',
          author: '박경리',
          pageNum: 1,
          pageSize: 5
        });
        
        console.log('상세 검색 결과:', result);
        new Notice(`${result.length}개의 결과를 찾았습니다.`);
      } catch (error) {
        console.error('상세 검색 실패:', error);
        new Notice('상세 검색 실패. 콘솔을 확인하세요.');
      }
    }
  });
}

/**
 * API 응답 로깅 유틸리티
 */
export class APILogger {
  static logRequest(url: string, params: any) {
    console.group('📤 API Request');
    console.log('URL:', url);
    console.log('Parameters:', params);
    console.groupEnd();
  }

  static logResponse(data: any) {
    console.group('📥 API Response');
    console.log('Data:', data);
    console.groupEnd();
  }

  static logError(error: any) {
    console.group('❌ API Error');
    console.error('Error:', error);
    if (error.response) {
      console.error('Response:', error.response);
    }
    console.groupEnd();
  }
}
