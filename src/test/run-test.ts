/**
 * TOC 테스트 실행 스크립트
 * 명령행에서 직접 실행 가능한 테스트 도구
 */

import { TOCTestSuite, TestResult, TestSummary } from './toc-test-suite';
import * as fs from 'fs';
import * as path from 'path';

// API 키 설정 (환경변수 또는 직접 입력)
const API_KEY = process.env.NLK_API_KEY || 'YOUR_API_KEY_HERE';

if (API_KEY === 'YOUR_API_KEY_HERE') {
  console.error('❌ API 키를 설정해주세요!');
  console.error('환경변수: export NLK_API_KEY="your_key_here"');
  console.error('또는 코드에서 직접 수정하세요.');
  process.exit(1);
}

async function main() {
  const testSuite = new TOCTestSuite(API_KEY);
  const args = process.argv.slice(2);

  try {
    let results: TestResult[];
    let summary: TestSummary;

    if (args.length > 0 && args[0] === '--category') {
      if (args.length < 2) {
        console.error('❌ 카테고리를 지정해주세요.');
        console.error('사용법: npm run test-toc -- --category general');
        console.error('카테고리: general, academic, series, children, ebook');
        process.exit(1);
      }

      const category = args[1];
      console.log(`🎯 카테고리별 테스트: ${category}`);
      const testResult = await testSuite.runCategoryTest(category);
      results = testResult.results;
      summary = testResult.summary;

    } else if (args.length > 0 && args[0] === '--help') {
      printHelp();
      return;

    } else {
      console.log('🚀 전체 테스트 스위트 실행');
      const testResult = await testSuite.runAllTests();
      results = testResult.results;
      summary = testResult.summary;
    }

    // 결과를 파일로 저장
    await saveTestResults(results, summary);

    // 최종 평가 및 권장사항
    printRecommendations(summary);

  } catch (error) {
    console.error('❌ 테스트 실행 중 오류 발생:', error);
    process.exit(1);
  }
}

/**
 * 테스트 결과를 파일로 저장
 */
async function saveTestResults(results: TestResult[], summary: TestSummary): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const testDir = path.join(__dirname, 'results');

  // 결과 디렉토리 생성
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // JSON 결과 저장
  const jsonFile = path.join(testDir, `toc-test-${timestamp}.json`);
  const jsonData = {
    timestamp: new Date().toISOString(),
    summary,
    results
  };
  fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2), 'utf8');
  console.log(`💾 JSON 결과 저장: ${jsonFile}`);

  // CSV 결과 저장
  const csvFile = path.join(testDir, `toc-test-${timestamp}.csv`);
  const testSuite = new TOCTestSuite('dummy'); // CSV 내보내기용
  const csvData = testSuite.exportResultsToCSV(results);
  fs.writeFileSync(csvFile, csvData, 'utf8');
  console.log(`📊 CSV 결과 저장: ${csvFile}`);

  // 마크다운 보고서 생성
  const mdFile = path.join(testDir, `toc-test-report-${timestamp}.md`);
  const mdContent = generateMarkdownReport(summary, results);
  fs.writeFileSync(mdFile, mdContent, 'utf8');
  console.log(`📝 보고서 저장: ${mdFile}`);
}

/**
 * 마크다운 보고서 생성
 */
function generateMarkdownReport(summary: TestSummary, results: TestResult[]): string {
  const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  let md = `# TOC 추출 테스트 보고서\n\n`;
  md += `**테스트 실행 시간**: ${timestamp}\n\n`;

  // 요약
  md += `## 📊 테스트 요약\n\n`;
  md += `| 항목 | 값 |\n`;
  md += `|------|----|\n`;
  md += `| 총 테스트 | ${summary.totalTests}권 |\n`;
  md += `| 성공 | ${summary.successCount}권 |\n`;
  md += `| 실패 | ${summary.failureCount}권 |\n`;
  md += `| **성공률** | **${summary.successRate.toFixed(1)}%** |\n`;
  md += `| 평균 응답시간 | ${summary.averageResponseTime.toFixed(0)}ms |\n\n`;

  // 방법별 통계
  md += `## 🔧 방법별 성공률\n\n`;
  md += `| 방법 | 성공/시도 | 성공률 |\n`;
  md += `|------|----------|-------|\n`;
  Object.entries(summary.methodStats).forEach(([method, stats]) => {
    const rate = stats.count > 0 ? (stats.success / stats.count * 100).toFixed(1) : '0.0';
    md += `| ${method} | ${stats.success}/${stats.count} | ${rate}% |\n`;
  });
  md += `\n`;

  // 카테고리별 통계
  md += `## 📚 카테고리별 성공률\n\n`;
  md += `| 카테고리 | 성공/시도 | 성공률 |\n`;
  md += `|----------|----------|-------|\n`;
  Object.entries(summary.categoryStats).forEach(([category, stats]) => {
    const rate = stats.count > 0 ? (stats.success / stats.count * 100).toFixed(1) : '0.0';
    md += `| ${category} | ${stats.success}/${stats.count} | ${rate}% |\n`;
  });
  md += `\n`;

  // 상세 결과
  md += `## 📖 상세 테스트 결과\n\n`;
  md += `| 도서명 | 카테고리 | 성공 | 방법 | 응답시간 | 오류 |\n`;
  md += `|--------|----------|------|------|----------|------|\n`;
  results.forEach(result => {
    const success = result.success ? '✅' : '❌';
    const error = result.error ? result.error.substring(0, 50) + '...' : '-';
    md += `| ${result.book.title} | ${result.book.category} | ${success} | ${result.method} | ${result.responseTime}ms | ${error} |\n`;
  });
  md += `\n`;

  // 성능 평가
  md += `## 🎯 성능 평가\n\n`;
  if (summary.successRate >= 70) {
    md += `🎉 **목표 달성!** 성공률 ${summary.successRate.toFixed(1)}%로 70% 목표를 달성했습니다.\n\n`;
  } else if (summary.successRate >= 50) {
    md += `🤔 **개선 필요** 성공률 ${summary.successRate.toFixed(1)}%로 목표에 근접했지만 추가 최적화가 필요합니다.\n\n`;
  } else {
    md += `⚠️ **대폭 개선 필요** 성공률 ${summary.successRate.toFixed(1)}%로 추가적인 개선이 필요합니다.\n\n`;
  }

  return md;
}

/**
 * 최종 평가 및 권장사항 출력
 */
function printRecommendations(summary: TestSummary): void {
  console.log('\n🎯 =========================');
  console.log('🎯 최종 평가 및 권장사항');
  console.log('🎯 =========================\n');

  // 성공률 기반 평가
  if (summary.successRate >= 70) {
    console.log('🎉 **목표 달성!**');
    console.log('   세션 기반 TOC 추출 시스템이 성공적으로 구현되었습니다.');
    console.log('   현재 성공률로도 사용자에게 충분한 가치를 제공할 수 있습니다.\n');

    console.log('🔧 **추천 사항:**');
    console.log('   1. 프로덕션 배포 준비');
    console.log('   2. 사용자 피드백 수집 체계 구축');
    console.log('   3. 성능 모니터링 도구 추가');

  } else if (summary.successRate >= 50) {
    console.log('🤔 **개선 필요**');
    console.log('   기본 목표에는 근접했지만 추가 최적화가 도움이 될 것입니다.\n');

    console.log('🔧 **개선 방안:**');
    console.log('   1. 실패한 방법들의 세부 조정');
    console.log('   2. 추가 폴백 방법 구현 고려');
    console.log('   3. 특정 카테고리별 최적화');

  } else {
    console.log('⚠️ **대폭 개선 필요**');
    console.log('   현재 성공률이 목표에 크게 못 미칩니다.\n');

    console.log('🚨 **긴급 개선 사항:**');
    console.log('   1. 세션 관리 로직 재검토');
    console.log('   2. Playwright 브라우저 자동화 구현');
    console.log('   3. API 엔드포인트 재분석');
  }

  // 방법별 분석
  const mostSuccessfulMethod = Object.entries(summary.methodStats)
    .filter(([_, stats]) => stats.count > 0)
    .sort((a, b) => (b[1].success / b[1].count) - (a[1].success / a[1].count))[0];

  if (mostSuccessfulMethod) {
    const [method, stats] = mostSuccessfulMethod;
    const rate = (stats.success / stats.count * 100).toFixed(1);
    console.log(`\n💡 **가장 성공적인 방법**: ${method} (${rate}%)`);
    console.log('   이 방법을 우선순위로 하여 다른 방법들을 개선해보세요.');
  }

  // 응답속도 분석
  if (summary.averageResponseTime > 10000) {
    console.log(`\n⏰ **응답속도 개선 필요**: 평균 ${(summary.averageResponseTime/1000).toFixed(1)}초`);
    console.log('   사용자 경험 향상을 위해 캐싱이나 병렬 처리를 고려해보세요.');
  }

  console.log('\n📈 **다음 단계:**');
  console.log('   1. 테스트 결과 분석 및 개선점 도출');
  console.log('   2. 실패 사례들의 수동 검증');
  console.log('   3. 사용자 인터페이스에 진도 표시 추가');
  console.log('   4. 정기적인 성능 모니터링 체계 구축\n');
}

/**
 * 도움말 출력
 */
function printHelp(): void {
  console.log('TOC 추출 테스트 도구\n');
  console.log('사용법:');
  console.log('  npm run test-toc              # 전체 테스트 실행');
  console.log('  npm run test-toc -- --category general   # 특정 카테고리만 테스트');
  console.log('  npm run test-toc -- --help    # 이 도움말 표시\n');
  console.log('카테고리:');
  console.log('  general   - 일반 도서');
  console.log('  academic  - 학술 도서');
  console.log('  series    - 시리즈 도서');
  console.log('  children  - 어린이 도서');
  console.log('  ebook     - 전자책\n');
  console.log('환경변수:');
  console.log('  NLK_API_KEY - 국립중앙도서관 API 키');
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}

export { main as runTest };