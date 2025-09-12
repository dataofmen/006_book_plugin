export interface BookInfo {
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  isbn: string;
  detailLink?: string;
  callNo?: string;
  kdcName?: string;
  kdcCode?: string;
  ddcCode?: string;
  summary?: string;
  tableOfContents?: string;
  controlNo?: string;
  imageUrl?: string;
  mediaType?: string;
  typeCode?: string;
  licenseInfo?: string;
  pages?: string;
  bookSize?: string;
  form?: string;
  ebookYn?: string;
  cipYn?: string;
  seriesTitle?: string;
  seriesNo?: string;
  edition?: string;
  subject?: string;
}

export interface PluginSettings {
  apiKey: string;
  noteFolder: string;
  noteTemplate: string;
  fileNameTemplate: string;
  autoCreateFolder: boolean;
  openNoteAfterCreation: boolean;
  searchResultLimit: number;
  enableTableOfContents: boolean;
  enableAdvancedSearch: boolean;
  defaultSearchTarget: SearchTarget;
  defaultCategory: string;
  enableImageDownload: boolean;
  imageFolder: string;
  maxConcurrentRequests: number;
  requestTimeout: number;
}

export interface SearchOptions {
  limit?: number;
  pageNum?: number;
  searchTarget?: SearchTarget;
  category?: Category;
  systemType?: SystemType;
  lnbTypeName?: string;
  sort?: SortOption;
  desc?: SortOrder;
  licYn?: LicenseType;
  govYn?: 'Y' | 'N';
  enableEnhancedInfo?: boolean;
}

export interface DetailedSearchParams {
  f1?: SearchField;
  v1?: string;
  and1?: LogicalOperator;
  f2?: SearchField;
  v2?: string;
  and2?: LogicalOperator;
  f3?: SearchField;
  v3?: string;
  and3?: LogicalOperator;
  f4?: SearchField;
  v4?: string;
  and4?: LogicalOperator;
  isbnOp?: 'isbn' | 'issn';
  isbnCode?: string;
  guCode3?: string;  // 별치기호
  guCode4?: string;  // 분류기호
  guCode5?: string;  // 도서
  guCode6?: string;  // 권책
  guCode7?: string;  // 한국대학명
  guCode8?: string;  // 한국정부기관명
  gu10?: string;     // 판종유형/판종
  guCode11?: string; // CIP제어번호
  gu12?: string;     // 본문언어
  gu13?: string;     // 요약언어
  gu14?: string;     // 간행빈도
  sYear?: string;    // 발행년도 시작
  eYear?: string;    // 발행년도 종료
  gu2?: ClassificationSystem;
  guCode2?: string;  // 분류코드값
}

export type SearchTarget = 'total' | 'title' | 'author' | 'publisher' | 'cheonggu';

export type SearchField = 
  | 'total' 
  | 'title' 
  | 'keyword' 
  | 'author' 
  | 'publisher'
  | 'abs_keyword'  // 초록
  | 'toc_keyword'; // 목차

export type LogicalOperator = 'AND' | 'OR' | 'NOT';

export type Category = 
  | '도서'
  | '고서/고문서'
  | '학위논문'
  | '잡지/학술지'
  | '신문'
  | '기사'
  | '멀티미디어'
  | '장애인자료'
  | '외부연계자료'
  | '웹사이트 수집'
  | '기타'
  | '해외한국관련기록물';

export type SystemType = '오프라인자료' | '온라인자료';

export type SortOption = 
  | 'ititle'      // 제목
  | 'iauthor'     // 저자
  | 'ipublisher'  // 발행처
  | 'ipub_year'   // 발행년도
  | 'cheonggu';   // 청구기호

export type SortOrder = 'asc' | 'desc';

export type LicenseType = 
  | 'S'  // 국립중앙도서관,협약도서관-인쇄 시 과금
  | 'F'  // 국립중앙도서관,협약도서관-열람,인쇄시 과금
  | 'Y'  // 국립중앙도서관,협약공공도서관,정기이용증소지자-무료
  | 'L'  // 국립중앙도서관-무료
  | 'N'  // 관외이용-무료
  | 'C'  // 국립중앙도서관,작은도서관-무료
  | 'U'  // 국립중앙도서관,국립어린이청소년도서관-무료
  | 'T'  // 국립중앙도서관,국립어린이청소년도서관,작은도서관-무료
  | 'R'  // 국립중앙도서관,정기이용증소지자-무료
  | 'D'  // 국립중앙도서관,국립어린이청소년도서관,국립세종도서관-무료
  | 'A'; // 국립중앙도서관,국립어린이청소년도서관,국립세종도서관,정기이용증소지자-무료

export type ClassificationSystem = 
  | 'kdc'  // 한국십진분류표
  | 'kdcp' // 한국십진분류표-박봉석편
  | 'ddc'  // 듀이십진분류표
  | 'cec'  // 조선총독부 신서부분류표
  | 'cwc'  // 조선총독부 양서부분류표
  | 'coc'  // 조선총독부 고서부분류표
  | 'gpo'; // 정부문서분류번호

export interface NLSearchResponse {
  total?: number;
  result?: any[];
  docs?: any[];
  items?: any[];
  error?: string;
  errorCode?: string;
  kwd?: string;
  category?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface ISBNSearchResponse {
  PAGE_NO?: string;
  TOTAL_COUNT?: string;
  docs?: ISBNBookData[];
  error?: string;
  errorCode?: string;
}

export interface ISBNBookData {
  TITLE?: string;
  VOL?: string;
  SERIES_TITLE?: string;
  SERIES_NO?: string;
  AUTHOR?: string;
  EA_ISBN?: string;
  EA_ADD_CODE?: string;
  SET_ISBN?: string;
  SET_ADD_CODE?: string;
  SET_EXPRESSION?: string;
  PUBLISHER?: string;
  EDITION_STMT?: string;
  PRE_PRICE?: string;
  KDC?: string;
  DDC?: string;
  PAGE?: string;
  BOOK_SIZE?: string;
  FORM?: string;
  PUBLISH_PREDATE?: string;
  SUBJECT?: string;
  EBOOK_YN?: string;
  CIP_YN?: string;
  CONTROL_NO?: string;
  TITLE_URL?: string;
  BOOK_TB_CNT_URL?: string;
  BOOK_INTRODUCTION_URL?: string;
  BOOK_SUMMARY_URL?: string;
  PUBLISHER_URL?: string;
  INPUT_DATE?: string;
  UPDATE_DATE?: string;
}

export interface SearchResultMeta {
  total: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  searchQuery: string;
  searchType: 'basic' | 'detailed' | 'toc' | 'isbn';
  enhancedCount: number;
  errorCount: number;
}

export interface EnhancementProgress {
  current: number;
  total: number;
  currentBook: string;
  hasError: boolean;
  errorMessage?: string;
}

// 템플릿 변수 인터페이스
export interface TemplateVariables {
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  isbn: string;
  date: string;
  callNo: string;
  kdcName: string;
  kdcCode: string;
  ddcCode: string;
  summary: string;
  tableOfContents: string;
  detailLink: string;
  imagePath: string;
  pages: string;
  bookSize: string;
  form: string;
  seriesTitle: string;
  edition: string;
  subject: string;
  mediaType: string;
  licenseInfo: string;
  controlNo: string;
}
