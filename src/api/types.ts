// API 응답 타입 정의
export interface NLKSearchResponse {
  kwd: string;
  category?: string;
  pageNum: number;
  pageSize: number;
  total: number;
  title_info?: string;
  type_name?: string;
  author_info?: string;
  pub_info?: string;
  pub_year_info?: string;
  control_no?: string;
  isbn?: string;
  call_no?: string;
  detail_link?: string;
  doc_yn?: string;
  org_link?: string;
}

export interface ISBNSearchResponse {
  PAGE_NO: string;
  TOTAL_COUNT: string;
  TITLE: string;
  VOL?: string;
  SERIES_TITLE?: string;
  AUTHOR: string;
  EA_ISBN: string;
  EA_ADD_CODE?: string;
  PUBLISHER: string;
  EDITION_STMT?: string;
  PRE_PRICE?: string;
  KDC?: string;
  DDC?: string;
  PAGE?: string;
  BOOK_SIZE?: string;
  FORM?: string;
  PUBLISH_PREDATE: string;
  SUBJECT?: string;
  EBOOK_YN: string;
  CIP_YN: string;
  CONTROL_NO?: string;
  TITLE_URL?: string;
  BOOK_TB_CNT_URL?: string;
  BOOK_INTRODUCTION_URL?: string;
  BOOK_SUMMARY_URL?: string;
  PUBLISHER_URL?: string;
  INPUT_DATE: string;
  UPDATE_DATE?: string;
}

export interface Book {
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  isbn: string;
  price?: string;
  pages?: string;
  size?: string;
  kdc?: string;
  ddc?: string;
  subject?: string;
  summary?: string;
  coverImage?: string;
  series?: string;
  volume?: string;
  edition?: string;
  ebook: boolean;
  callNumber?: string;
  detailLink?: string;
  controlNo?: string; // 추출된 CONTROL_NO 저장용

  // 카카오 API 추가 필드
  kakaoUrl?: string;
  kakaoThumbnail?: string;
  kakaoContents?: string;
  kakaoPrice?: number;
  kakaoSalePrice?: number;
  kakaoTableOfContents?: string;
  source?: 'nlk' | 'kakao' | 'integrated';
  hasKakaoData?: boolean;
}

export interface SearchParams {
  query?: string;
  isbn?: string;
  title?: string;
  author?: string;
  publisher?: string;
  pageNum?: number;
  pageSize?: number;
  sort?: 'title' | 'author' | 'publisher' | 'pub_year' | 'relevance';
  order?: 'asc' | 'desc';
}
