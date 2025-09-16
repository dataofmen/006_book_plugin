/**
 * TOC 추출 시스템 테스트 및 검증 도구
 * 다양한 도서로 새로운 세션 기반 시스템의 성공률 측정
 */

import { NationalLibraryAPI } from '../api/nlk-api';
import { Book, SearchParams } from '../api/types';
import { ErrorHandler, ErrorContext } from '../utils/error-handler';

export interface TestBook {
  title: string;
  author?: string;
  isbn?: string;
  controlNo?: string;
  category: 'general' | 'ebook' | 'series' | 'academic' | 'children';
  expectedHasTOC: boolean; // 실제로 목차가 있을 것으로 예상되는지
}

export interface TestResult {
  book: TestBook;
  success: boolean;
  method: string;
  tocLength?: number;
  responseTime: number;
  error?: string;
  userMessage?: string;
}

export interface TestSummary {
  totalTests: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageResponseTime: number;
  methodStats: Record<string, { count: number; success: number }>;
  categoryStats: Record<string, { count: number; success: number }>;
}

export class TOCTestSuite {
  private api: NationalLibraryAPI;
  private testBooks: TestBook[] = [
    // 일반 도서 (목차 있을 가능성 높음)
    {
      title: '코스모스',
      author: '칼 세이건',
      category: 'general',
      expectedHasTOC: true
    },
    {
      title: '사피엔스',
      author: '유발 하라리',
      category: 'general',
      expectedHasTOC: true
    },
    {
      title: '총균쇠',
      author: '재레드 다이아몬드',
      category: 'general',
      expectedHasTOC: true
    },
    {
      title: '나미야 잡화점의 기적',
      author: '히가시노 게이고',
      category: 'general',
      expectedHasTOC: false // 소설은 목차가 없을 수도
    },
    {
      title: '미움받을 용기',
      author: '기시미 이치로',
      category: 'general',
      expectedHasTOC: true
    },

    // 학술 도서 (목차 있을 가능성 매우 높음)
    {
      title: '자바의 정석',
      author: '남궁성',
      category: 'academic',
      expectedHasTOC: true
    },
    {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      category: 'academic',
      expectedHasTOC: true
    },
    {
      title: '컴퓨터구조론',
      category: 'academic',
      expectedHasTOC: true
    },

    // 시리즈 도서
    {
      title: '해리 포터와 마법사의 돌',
      author: 'J.K. 롤링',
      category: 'series',
      expectedHasTOC: false
    },
    {
      title: '원피스',
      category: 'series',
      expectedHasTOC: false
    },

    // 어린이 도서
    {
      title: '마법천자문',
      category: 'children',
      expectedHasTOC: true
    },
    {
      title: '과학동아',
      category: 'children',
      expectedHasTOC: true
    },

    // 전자책
    {
      title: '디지털 마케팅',
      category: 'ebook',
      expectedHasTOC: true
    },
    {
      title: '인공지능 시대의 교육',
      category: 'ebook',
      expectedHasTOC: true
    }
  ];

  constructor(apiKey: string) {
    this.api = new NationalLibraryAPI(apiKey);
  }

  /**
   * 전체 테스트 스위트 실행
   */
  async runAllTests(): Promise<{ results: TestResult[]; summary: TestSummary }> {
    console.log('🧪 TOC 추출 테스트 스위트 시작');
    console.log(`📊 총 ${this.testBooks.length}권의 도서로 테스트 진행\n`);

    const results: TestResult[] = [];
    const startTime = Date.now();

    for (let i = 0; i < this.testBooks.length; i++) {
      const testBook = this.testBooks[i];
      console.log(`📖 [${i + 1}/${this.testBooks.length}] "${testBook.title}" 테스트 중...`);

      const result = await this.testSingleBook(testBook);
      results.push(result);

      // 결과 출력
      if (result.success) {
        console.log(`✅ 성공 - 방법: ${result.method}, 길이: ${result.tocLength}글자, 시간: ${result.responseTime}ms`);
      } else {
        console.log(`❌ 실패 - 오류: ${result.error}`);
      }

      console.log(''); // 빈 줄

      // API 부하 방지를 위한 간격
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const totalTime = Date.now() - startTime;
    const summary = this.generateSummary(results);

    console.log('🎉 테스트 완료!');
    console.log(`📊 총 소요 시간: ${totalTime}ms`);
    this.printSummary(summary);

    return { results, summary };
  }

  /**
   * 개별 도서 테스트
   */
  private async testSingleBook(testBook: TestBook): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // 1단계: 도서 검색
      const searchResults = await this.api.searchBooks({
        query: testBook.title,
        pageNum: 1,
        pageSize: 10
      });

      if (!searchResults || searchResults.length === 0) {
        return {
          book: testBook,
          success: false,
          method: 'search_failed',
          responseTime: Date.now() - startTime,
          error: '도서 검색 실패',
          userMessage: '해당 도서를 찾을 수 없습니다.'
        };
      }

      // 저자명으로 필터링 (있는 경우)
      let targetBook = searchResults[0];
      if (testBook.author) {
        const filtered = searchResults.find(book =>
          book.author && book.author.includes(testBook.author!)
        );
        if (filtered) {
          targetBook = filtered;
        }
      }

      console.log(`   📚 도서 정보: ${targetBook.title} - ${targetBook.author || '저자 불명'}`);
      console.log(`   🔢 Control No: ${targetBook.controlNo || '없음'}, ISBN: ${targetBook.isbn || '없음'}`);

      // 목차 추출 기능이 제거되어 테스트 스킵
      const tocResult = { success: false, content: '', error: 'TOC functionality removed', method: 'disabled' };

      const responseTime = Date.now() - startTime;

      if (tocResult.success && tocResult.content) {
        return {
          book: testBook,
          success: true,
          method: tocResult.method,
          tocLength: tocResult.content.length,
          responseTime,
          userMessage: ErrorHandler.generateSuccessMessage(
            targetBook.title,
            tocResult.method,
            responseTime,
            tocResult.content.length
          )
        };
      } else {
        return {
          book: testBook,
          success: false,
          method: tocResult.method || 'unknown',
          responseTime,
          error: tocResult.error || '알 수 없는 오류',
          userMessage: ErrorHandler.generateTOCFailureMessage(
            targetBook.title,
            [tocResult.error || '추출 실패'],
            [tocResult.method],
            responseTime
          )
        };
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        book: testBook,
        success: false,
        method: 'exception',
        responseTime,
        error: errorMessage,
        userMessage: `테스트 중 예외 발생: ${errorMessage}`
      };
    }
  }

  /**
   * 테스트 결과 요약 생성
   */
  private generateSummary(results: TestResult[]): TestSummary {
    const totalTests = results.length;
    const successCount = results.filter(r => r.success).length;
    const failureCount = totalTests - successCount;
    const successRate = totalTests > 0 ? (successCount / totalTests) * 100 : 0;

    const totalResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0);
    const averageResponseTime = totalTests > 0 ? totalResponseTime / totalTests : 0;

    // 방법별 통계
    const methodStats: Record<string, { count: number; success: number }> = {};
    results.forEach(result => {
      if (!methodStats[result.method]) {
        methodStats[result.method] = { count: 0, success: 0 };
      }
      methodStats[result.method].count++;
      if (result.success) {
        methodStats[result.method].success++;
      }
    });

    // 카테고리별 통계
    const categoryStats: Record<string, { count: number; success: number }> = {};
    results.forEach(result => {
      const category = result.book.category;
      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, success: 0 };
      }
      categoryStats[category].count++;
      if (result.success) {
        categoryStats[category].success++;
      }
    });

    return {
      totalTests,
      successCount,
      failureCount,
      successRate,
      averageResponseTime,
      methodStats,
      categoryStats
    };
  }

  /**
   * 요약 결과 출력
   */
  private printSummary(summary: TestSummary): void {
    console.log('\n📊 =========================');
    console.log('📊 테스트 결과 요약');
    console.log('📊 =========================');

    console.log(`\n🎯 전체 결과:`);
    console.log(`   📚 총 테스트: ${summary.totalTests}권`);
    console.log(`   ✅ 성공: ${summary.successCount}권`);
    console.log(`   ❌ 실패: ${summary.failureCount}권`);
    console.log(`   📈 성공률: ${summary.successRate.toFixed(1)}%`);
    console.log(`   ⏱️ 평균 응답시간: ${summary.averageResponseTime.toFixed(0)}ms`);

    console.log(`\n🔧 방법별 성공률:`);
    Object.entries(summary.methodStats).forEach(([method, stats]) => {
      const rate = stats.count > 0 ? (stats.success / stats.count * 100).toFixed(1) : '0.0';
      console.log(`   ${method}: ${stats.success}/${stats.count} (${rate}%)`);
    });

    console.log(`\n📚 카테고리별 성공률:`);
    Object.entries(summary.categoryStats).forEach(([category, stats]) => {
      const rate = stats.count > 0 ? (stats.success / stats.count * 100).toFixed(1) : '0.0';
      console.log(`   ${category}: ${stats.success}/${stats.count} (${rate}%)`);
    });

    // 성능 평가
    console.log(`\n🎯 성능 평가:`);
    if (summary.successRate >= 70) {
      console.log(`   🎉 목표 달성! (70% 이상)`);
    } else if (summary.successRate >= 50) {
      console.log(`   🤔 개선 필요 (50-70%)`);
    } else if (summary.successRate >= 30) {
      console.log(`   ⚠️ 대폭 개선 필요 (30-50%)`);
    } else {
      console.log(`   🚨 심각한 문제 (30% 미만)`);
    }

    if (summary.averageResponseTime > 10000) {
      console.log(`   🐌 응답속도 느림 (${(summary.averageResponseTime/1000).toFixed(1)}초)`);
    } else if (summary.averageResponseTime > 5000) {
      console.log(`   ⚠️ 응답속도 보통 (${(summary.averageResponseTime/1000).toFixed(1)}초)`);
    } else {
      console.log(`   ⚡ 응답속도 양호 (${(summary.averageResponseTime/1000).toFixed(1)}초)`);
    }
  }

  /**
   * 특정 카테고리만 테스트
   */
  async runCategoryTest(category: string): Promise<{ results: TestResult[]; summary: TestSummary }> {
    const categoryBooks = this.testBooks.filter(book => book.category === category);

    if (categoryBooks.length === 0) {
      throw new Error(`카테고리 '${category}'에 해당하는 테스트 도서가 없습니다.`);
    }

    console.log(`🧪 카테고리 '${category}' 테스트 시작 (${categoryBooks.length}권)`);

    const results: TestResult[] = [];

    for (const testBook of categoryBooks) {
      console.log(`📖 "${testBook.title}" 테스트 중...`);
      const result = await this.testSingleBook(testBook);
      results.push(result);

      if (result.success) {
        console.log(`✅ 성공 - ${result.method}`);
      } else {
        console.log(`❌ 실패 - ${result.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const summary = this.generateSummary(results);
    this.printSummary(summary);

    return { results, summary };
  }

  /**
   * 테스트 결과를 CSV 파일로 내보내기
   */
  exportResultsToCSV(results: TestResult[]): string {
    const headers = [
      'Title', 'Author', 'Category', 'Expected_TOC', 'Success',
      'Method', 'TOC_Length', 'Response_Time_ms', 'Error', 'User_Message'
    ];

    const rows = results.map(result => [
      result.book.title,
      result.book.author || '',
      result.book.category,
      result.book.expectedHasTOC.toString(),
      result.success.toString(),
      result.method,
      result.tocLength?.toString() || '',
      result.responseTime.toString(),
      result.error || '',
      result.userMessage || ''
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csv;
  }
}