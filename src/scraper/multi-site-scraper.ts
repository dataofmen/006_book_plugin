import { BookScraper, ScrapingResult, ScrapingOptions, TOCCache } from './types';
import { KyoboScraper } from './kyobo-scraper';
import { AladinScraper } from './aladin-scraper';
import { Yes24Scraper } from './yes24-scraper';

export class MultiSiteScraper {
  private scrapers: BookScraper[];
  private cache: TOCCache;

  constructor(options: ScrapingOptions = {}) {
    this.scrapers = [
      new KyoboScraper(options),
      new AladinScraper(options),
      new Yes24Scraper(options)
    ];

    this.cache = new SimpleCache();
  }

  async scrapeTOC(isbn: string, title?: string): Promise<ScrapingResult | null> {
    // 캐시 확인
    const cacheKey = this.getCacheKey(isbn, title);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        source: 'Cache',
        toc: cached,
        confidence: 100
      };
    }

    const results: ScrapingResult[] = [];

    // 병렬로 모든 사이트 스크래핑
    const scrapingPromises = this.scrapers.map(async (scraper) => {
      try {
        const toc = await scraper.scrape(isbn, title);
        if (toc && toc.length > 50) { // 최소 길이 체크
          const result: ScrapingResult = {
            source: scraper.name,
            toc,
            confidence: this.calculateConfidence(toc)
          };
          return result;
        }
      } catch (error) {
        console.warn(`${scraper.name} scraping failed:`, error);
      }
      return null;
    });

    const settledResults = await Promise.allSettled(scrapingPromises);

    // 성공한 결과들만 수집
    settledResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    });

    if (results.length === 0) {
      return null;
    }

    // 가장 높은 신뢰도의 결과 선택
    const bestResult = results.sort((a, b) => b.confidence - a.confidence)[0];

    // 캐시에 저장
    this.cache.set(cacheKey, bestResult.toc);

    return bestResult;
  }

  private calculateConfidence(toc: string): number {
    let score = 0;

    // 기본 점수 (유효한 목차라면)
    score += 10;

    // 한국어 목차 구조 패턴
    if (toc.includes('장') || toc.includes('편') || toc.includes('부')) score += 20;
    if (toc.includes('제1장') || toc.includes('제 1 장')) score += 15;

    // 영어 목차 구조 패턴
    if (toc.includes('Chapter') || toc.includes('Part')) score += 15;
    if (toc.match(/Chapter\s+\d+/i)) score += 10;

    // 번호 매김 패턴
    if (toc.match(/\d+\./g)) score += 10;
    if (toc.match(/\d+\-\d+/g)) score += 5; // 1-1, 2-3 형태

    // 목차 길이 평가
    if (toc.length > 200) score += 15;
    if (toc.length > 500) score += 10;
    if (toc.length > 1000) score += 5;

    // 페이지 번호 존재
    if (toc.includes('페이지') || toc.match(/p\.\s*\d+/i)) score += 10;
    if (toc.match(/\d+\s*쪽/)) score += 8;

    // 구조적 완성도
    const lines = toc.split('\n').filter(line => line.trim());
    if (lines.length > 5) score += 10;
    if (lines.length > 10) score += 5;

    // 특수 문자나 포맷팅 존재 (잘 정리된 목차)
    if (toc.includes('·') || toc.includes('•') || toc.includes('-')) score += 5;

    // 너무 반복적이거나 의미없는 내용 감점
    if (toc.includes('...') && (toc.match(/\.\.\./g) || []).length > 10) score -= 10;
    if (toc.length < 100) score -= 20;

    return Math.max(0, Math.min(score, 100));
  }

  private getCacheKey(isbn: string, title?: string): string {
    return isbn || title || 'unknown';
  }

  // 모든 결과를 반환 (사용자가 선택할 수 있도록)
  async scrapeAllSources(isbn: string, title?: string): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];

    for (const scraper of this.scrapers) {
      try {
        const toc = await scraper.scrape(isbn, title);
        if (toc && toc.length > 50) {
          results.push({
            source: scraper.name,
            toc,
            confidence: this.calculateConfidence(toc)
          });
        }
      } catch (error) {
        console.warn(`${scraper.name} scraping failed:`, error);
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}

// 간단한 인메모리 캐시 구현
class SimpleCache implements TOCCache {
  private cache = new Map<string, { toc: string; timestamp: number }>();
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7일

  get(key: string): string | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // 캐시 만료 확인
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return cached.toc;
  }

  set(key: string, toc: string): void {
    this.cache.set(key, {
      toc,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }
}