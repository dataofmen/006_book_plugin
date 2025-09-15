// 웹 스크래핑 관련 타입 정의

export interface ScrapingResult {
  source: string;
  toc: string;
  confidence: number;
  metadata?: {
    title?: string;
    author?: string;
    publisher?: string;
    isbn?: string;
  };
}

export interface BookScraper {
  name: string;
  scrape(isbn: string, title?: string): Promise<string>;
}

export interface ScrapingOptions {
  timeout?: number;
  retries?: number;
  useCache?: boolean;
  proxyUrl?: string;
}

export interface TOCCache {
  get(key: string): string | null;
  set(key: string, toc: string): void;
  clear(): void;
}

export interface ProxyResponse {
  contents: string;
  status: {
    url: string;
    content_type: string;
    http_code: number;
    response_time: number;
  };
}