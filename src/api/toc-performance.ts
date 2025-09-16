/**
 * 목차 추출 성능 모니터링 및 통계 클래스
 */
export interface PerformanceMetrics {
  totalAttempts: number;
  totalSuccesses: number;
  totalResponseTime: number;
  methodBreakdown: Record<string, {
    attempts: number;
    successes: number;
    avgResponseTime: number;
    avgConfidence: number;
    lastUsed: Date;
  }>;
  confidenceDistribution: {
    high: number; // 0.8+
    medium: number; // 0.5-0.8
    low: number; // 0.5-
  };
  recentResults: Array<{
    timestamp: Date;
    book: string;
    method: string;
    success: boolean;
    confidence: number;
    responseTime: number;
  }>;
}

export class TOCPerformanceMonitor {
  private metrics: PerformanceMetrics;
  private readonly maxRecentResults = 100;

  constructor() {
    this.resetMetrics();
  }

  /**
   * 메트릭스 초기화
   */
  private resetMetrics(): void {
    this.metrics = {
      totalAttempts: 0,
      totalSuccesses: 0,
      totalResponseTime: 0,
      methodBreakdown: {},
      confidenceDistribution: {
        high: 0,
        medium: 0,
        low: 0
      },
      recentResults: []
    };
  }

  /**
   * 추출 결과 기록
   */
  recordResult(
    bookTitle: string,
    method: string,
    success: boolean,
    confidence: number,
    responseTime: number
  ): void {
    this.metrics.totalAttempts++;
    this.metrics.totalResponseTime += responseTime;

    if (success) {
      this.metrics.totalSuccesses++;
    }

    // 방법별 통계 업데이트
    if (!this.metrics.methodBreakdown[method]) {
      this.metrics.methodBreakdown[method] = {
        attempts: 0,
        successes: 0,
        avgResponseTime: 0,
        avgConfidence: 0,
        lastUsed: new Date()
      };
    }

    const methodStats = this.metrics.methodBreakdown[method];
    methodStats.attempts++;
    methodStats.lastUsed = new Date();

    if (success) {
      methodStats.successes++;

      // 평균 응답시간 업데이트
      methodStats.avgResponseTime =
        (methodStats.avgResponseTime * (methodStats.successes - 1) + responseTime) / methodStats.successes;

      // 평균 신뢰도 업데이트
      methodStats.avgConfidence =
        (methodStats.avgConfidence * (methodStats.successes - 1) + confidence) / methodStats.successes;

      // 신뢰도 분포 업데이트
      if (confidence >= 0.8) {
        this.metrics.confidenceDistribution.high++;
      } else if (confidence >= 0.5) {
        this.metrics.confidenceDistribution.medium++;
      } else {
        this.metrics.confidenceDistribution.low++;
      }
    }

    // 최근 결과 기록
    this.metrics.recentResults.push({
      timestamp: new Date(),
      book: bookTitle,
      method,
      success,
      confidence,
      responseTime
    });

    // 최근 결과 목록 크기 제한
    if (this.metrics.recentResults.length > this.maxRecentResults) {
      this.metrics.recentResults.shift();
    }
  }

  /**
   * 전체 성공률 조회
   */
  getOverallSuccessRate(): number {
    return this.metrics.totalAttempts > 0 ?
      this.metrics.totalSuccesses / this.metrics.totalAttempts : 0;
  }

  /**
   * 평균 응답시간 조회
   */
  getAverageResponseTime(): number {
    return this.metrics.totalAttempts > 0 ?
      this.metrics.totalResponseTime / this.metrics.totalAttempts : 0;
  }

  /**
   * 방법별 성공률 조회 (정렬됨)
   */
  getMethodSuccessRates(): Array<{
    method: string;
    successRate: number;
    attempts: number;
    avgResponseTime: number;
    avgConfidence: number;
    lastUsed: Date;
  }> {
    return Object.entries(this.metrics.methodBreakdown)
      .map(([method, stats]) => ({
        method,
        successRate: stats.attempts > 0 ? stats.successes / stats.attempts : 0,
        attempts: stats.attempts,
        avgResponseTime: stats.avgResponseTime,
        avgConfidence: stats.avgConfidence,
        lastUsed: stats.lastUsed
      }))
      .sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * 최고 성능 방법 추천
   */
  getBestMethod(): string | null {
    const methodStats = this.getMethodSuccessRates();

    if (methodStats.length === 0) return null;

    // 성공률과 신뢰도를 종합 고려
    const scoredMethods = methodStats
      .filter(stats => stats.attempts >= 3) // 최소 3번 이상 사용된 방법만
      .map(stats => ({
        ...stats,
        compositeScore: stats.successRate * 0.7 + stats.avgConfidence * 0.3
      }))
      .sort((a, b) => b.compositeScore - a.compositeScore);

    return scoredMethods.length > 0 ? scoredMethods[0].method : methodStats[0].method;
  }

  /**
   * 성능 개선 추천사항
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const overallSuccessRate = this.getOverallSuccessRate();
    const avgResponseTime = this.getAverageResponseTime();
    const methodStats = this.getMethodSuccessRates();

    // 전체 성공률 기반 추천
    if (overallSuccessRate < 0.5) {
      recommendations.push('전체 성공률이 50% 미만입니다. API 키 확인 또는 네트워크 상태를 점검하세요.');
    } else if (overallSuccessRate < 0.7) {
      recommendations.push('성공률 개선을 위해 더 많은 추출 방법을 활성화하는 것을 고려하세요.');
    }

    // 응답시간 기반 추천
    if (avgResponseTime > 10000) {
      recommendations.push('평균 응답시간이 10초를 초과합니다. 네트워크 상태를 확인하세요.');
    } else if (avgResponseTime > 5000) {
      recommendations.push('응답시간 최적화를 위해 더 빠른 추출 방법을 우선 사용하세요.');
    }

    // 방법별 추천
    if (methodStats.length > 0) {
      const bestMethod = methodStats[0];
      if (bestMethod.successRate > 0.8) {
        recommendations.push(`${bestMethod.method} 방법의 성공률이 높습니다 (${(bestMethod.successRate * 100).toFixed(1)}%). 이 방법을 우선 사용하세요.`);
      }

      // 사용되지 않는 방법 확인
      const recentlyUsedMethods = methodStats.filter(stats => {
        const hoursSinceLastUse = (Date.now() - stats.lastUsed.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastUse < 24;
      });

      if (recentlyUsedMethods.length < methodStats.length / 2) {
        recommendations.push('일부 추출 방법이 최근에 사용되지 않았습니다. 설정을 확인하세요.');
      }
    }

    // 신뢰도 분포 기반 추천
    const { high, medium, low } = this.metrics.confidenceDistribution;
    const total = high + medium + low;

    if (total > 0) {
      const highRatio = high / total;
      if (highRatio < 0.3) {
        recommendations.push('고신뢰도 결과의 비율이 낮습니다. 더 정확한 추출 방법의 개발이 필요할 수 있습니다.');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('목차 추출 시스템이 정상적으로 작동하고 있습니다.');
    }

    return recommendations;
  }

  /**
   * 상세 성능 리포트 생성
   */
  generateReport(): string {
    const overallSuccessRate = this.getOverallSuccessRate();
    const avgResponseTime = this.getAverageResponseTime();
    const methodStats = this.getMethodSuccessRates();
    const bestMethod = this.getBestMethod();
    const recommendations = this.getRecommendations();

    let report = '📊 목차 추출 성능 리포트\n';
    report += '='.repeat(50) + '\n\n';

    // 전체 통계
    report += `📈 전체 통계:\n`;
    report += `  • 총 시도: ${this.metrics.totalAttempts}회\n`;
    report += `  • 총 성공: ${this.metrics.totalSuccesses}회\n`;
    report += `  • 전체 성공률: ${(overallSuccessRate * 100).toFixed(1)}%\n`;
    report += `  • 평균 응답시간: ${avgResponseTime.toFixed(0)}ms\n\n`;

    // 신뢰도 분포
    const { high, medium, low } = this.metrics.confidenceDistribution;
    const total = high + medium + low;
    if (total > 0) {
      report += `🎯 신뢰도 분포:\n`;
      report += `  • 높음 (≥80%): ${high}회 (${(high / total * 100).toFixed(1)}%)\n`;
      report += `  • 보통 (50-80%): ${medium}회 (${(medium / total * 100).toFixed(1)}%)\n`;
      report += `  • 낮음 (<50%): ${low}회 (${(low / total * 100).toFixed(1)}%)\n\n`;
    }

    // 방법별 성능
    if (methodStats.length > 0) {
      report += `🔧 방법별 성능:\n`;
      methodStats.forEach((stats, index) => {
        const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        report += `  ${rank} ${stats.method}:\n`;
        report += `     성공률: ${(stats.successRate * 100).toFixed(1)}% (${stats.attempts}회 시도)\n`;
        report += `     평균 응답시간: ${stats.avgResponseTime.toFixed(0)}ms\n`;
        report += `     평균 신뢰도: ${(stats.avgConfidence * 100).toFixed(1)}%\n`;
        report += `     마지막 사용: ${stats.lastUsed.toLocaleString()}\n\n`;
      });
    }

    // 최고 성능 방법
    if (bestMethod) {
      report += `⭐ 추천 방법: ${bestMethod}\n\n`;
    }

    // 최근 결과 (최근 5개)
    if (this.metrics.recentResults.length > 0) {
      report += `📝 최근 결과 (최근 5개):\n`;
      this.metrics.recentResults
        .slice(-5)
        .reverse()
        .forEach((result, index) => {
          const status = result.success ? '✅' : '❌';
          report += `  ${status} ${result.book} (${result.method})\n`;
          report += `     신뢰도: ${(result.confidence * 100).toFixed(1)}%, 응답시간: ${result.responseTime}ms\n`;
          report += `     시간: ${result.timestamp.toLocaleString()}\n\n`;
        });
    }

    // 추천사항
    report += `💡 추천사항:\n`;
    recommendations.forEach((rec, index) => {
      report += `  ${index + 1}. ${rec}\n`;
    });

    return report;
  }

  /**
   * 메트릭스 조회
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 메트릭스 내보내기 (JSON)
   */
  exportMetrics(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * 메트릭스 가져오기 (JSON)
   */
  importMetrics(jsonData: string): boolean {
    try {
      const imported = JSON.parse(jsonData);

      // 기본 유효성 검사
      if (typeof imported.totalAttempts === 'number' &&
          typeof imported.totalSuccesses === 'number') {

        // 날짜 객체 복원
        if (imported.recentResults) {
          imported.recentResults = imported.recentResults.map((result: any) => ({
            ...result,
            timestamp: new Date(result.timestamp)
          }));
        }

        if (imported.methodBreakdown) {
          Object.values(imported.methodBreakdown).forEach((method: any) => {
            if (method.lastUsed) {
              method.lastUsed = new Date(method.lastUsed);
            }
          });
        }

        this.metrics = imported;
        return true;
      }

      return false;
    } catch (error) {
      console.error('메트릭스 가져오기 실패:', error);
      return false;
    }
  }

  /**
   * 메트릭스 리셋
   */
  reset(): void {
    this.resetMetrics();
  }
}