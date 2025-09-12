import { PluginSettings } from './types';

export const DEFAULT_SETTINGS: PluginSettings = {
  apiKey: "",
  noteFolder: "_References/Books",
  noteTemplate: `---
title: "{{title}}"
author: "{{author}}"
publisher: "{{publisher}}"
publishDate: "{{publishDate}}"
isbn: "{{isbn}}"
tags: [book, reference]
created: {{date}}
type: book-note
---

# {{title}}

{{imagePath}}

## 📖 도서 정보

- **저자**: {{author}}
- **출판사**: {{publisher}}
- **출판일**: {{publishDate}}
- **ISBN**: {{isbn}}
{{callNo}}
{{kdcName}}
{{kdcCode}}
{{ddcCode}}
{{pages}}
{{bookSize}}
{{form}}
{{seriesTitle}}
{{edition}}
{{subject}}
{{mediaType}}

{{summary}}

{{tableOfContents}}

## 📝 독서 노트

### 💡 주요 내용

### 🤔 개인적 생각

### 📌 인상 깊은 구절

> 

### 🏷️ 키워드

### 💭 질문과 의문점

## 🔗 관련 자료

{{detailLink}}

## 📊 메타데이터

- **분류코드**: {{kdcCode}} {{ddcCode}}
- **제어번호**: {{controlNo}}
- **매체 유형**: {{mediaType}}
- **이용 제한**: {{licenseInfo}}
- **노트 생성일**: {{date}}

---

*이 노트는 국립중앙도서관 API를 통해 자동 생성되었습니다.*
`,
  fileNameTemplate: "{{title}} - {{author}}",
  autoCreateFolder: true,
  openNoteAfterCreation: true,
  searchResultLimit: 20,
  enableTableOfContents: true,
  enableAdvancedSearch: true,
  defaultSearchTarget: 'total',
  defaultCategory: '',
  enableImageDownload: false,
  imageFolder: "_Assets/Images/Books",
  maxConcurrentRequests: 3,
  requestTimeout: 30000
};

// 검색 옵션 프리셋
export const SEARCH_PRESETS = {
  general: {
    name: '일반 검색',
    description: '제목, 저자, 출판사 등 전체 필드에서 검색',
    searchTarget: 'total' as const
  },
  title: {
    name: '제목 검색',
    description: '도서 제목에서만 검색',
    searchTarget: 'title' as const
  },
  author: {
    name: '저자 검색', 
    description: '저자명에서만 검색',
    searchTarget: 'author' as const
  },
  publisher: {
    name: '출판사 검색',
    description: '출판사명에서만 검색',
    searchTarget: 'publisher' as const
  },
  toc: {
    name: '목차 검색',
    description: '목차 내용에서 키워드 검색',
    searchTarget: 'total' as const,
    useDetailedSearch: true
  }
};

// 카테고리 옵션
export const CATEGORY_OPTIONS = [
  { value: '', label: '전체' },
  { value: '도서', label: '도서' },
  { value: '고서/고문서', label: '고서/고문서' },
  { value: '학위논문', label: '학위논문' },
  { value: '잡지/학술지', label: '잡지/학술지' },
  { value: '신문', label: '신문' },
  { value: '기사', label: '기사' },
  { value: '멀티미디어', label: '멀티미디어' },
  { value: '장애인자료', label: '장애인자료' },
  { value: '외부연계자료', label: '외부연계자료' },
  { value: '웹사이트 수집', label: '웹사이트 수집' },
  { value: '기타', label: '기타' },
  { value: '해외한국관련기록물', label: '해외한국관련기록물' }
];

// 라이센스 옵션
export const LICENSE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'N', label: '관외이용 무료' },
  { value: 'L', label: '국립중앙도서관 무료' },
  { value: 'Y', label: '협약도서관 무료' },
  { value: 'C', label: '작은도서관 무료' },
  { value: 'U', label: '어린이청소년도서관 무료' },
  { value: 'A', label: '모든 국립도서관 무료' },
  { value: 'S', label: '인쇄 시 과금' },
  { value: 'F', label: '열람, 인쇄 시 과금' }
];

// 정렬 옵션
export const SORT_OPTIONS = [
  { value: '', label: '정확도순' },
  { value: 'ititle', label: '제목순' },
  { value: 'iauthor', label: '저자순' },
  { value: 'ipublisher', label: '출판사순' },
  { value: 'ipub_year', label: '출판년도순' },
  { value: 'cheonggu', label: '청구기호순' }
];

// 템플릿 변수 설명
export const TEMPLATE_VARIABLES = {
  basic: {
    '{{title}}': '도서 제목',
    '{{author}}': '저자',
    '{{publisher}}': '출판사',
    '{{publishDate}}': '출판일',
    '{{isbn}}': 'ISBN',
    '{{date}}': '노트 생성일 (YYYY-MM-DD)',
  },
  classification: {
    '{{callNo}}': '청구기호 (있는 경우)',
    '{{kdcName}}': '한국십진분류 이름 (있는 경우)',
    '{{kdcCode}}': '한국십진분류 코드 (있는 경우)', 
    '{{ddcCode}}': '듀이십진분류 코드 (있는 경우)',
  },
  content: {
    '{{summary}}': '도서 소개 (있는 경우)',
    '{{tableOfContents}}': '목차 (있는 경우)',
    '{{detailLink}}': '상세 정보 링크',
    '{{imagePath}}': '표지 이미지',
  },
  metadata: {
    '{{pages}}': '페이지 수 (있는 경우)',
    '{{bookSize}}': '책 크기 (있는 경우)',
    '{{form}}': '발행 형태 (있는 경우)',
    '{{seriesTitle}}': '총서명 (있는 경우)',
    '{{edition}}': '판사항 (있는 경우)',
    '{{subject}}': '주제 (있는 경우)',
    '{{mediaType}}': '매체 유형 (있는 경우)',
    '{{licenseInfo}}': '이용 제한 정보 (있는 경우)',
    '{{controlNo}}': '제어번호 (있는 경우)',
  }
};

// 기본 템플릿 변형들
export const TEMPLATE_PRESETS = {
  minimal: {
    name: '간단한 템플릿',
    template: `# {{title}}

**저자**: {{author}}  
**출판사**: {{publisher}} ({{publishDate}})  
**ISBN**: {{isbn}}

{{summary}}

## 메모

{{detailLink}}`
  },
  
  academic: {
    name: '학술용 템플릿',
    template: `---
title: "{{title}}"
author: "{{author}}"
publisher: "{{publisher}}"
year: "{{publishDate}}"
isbn: "{{isbn}}"
classification: "{{kdcCode}}"
tags: [academic, book]
created: {{date}}
---

# {{title}}

## 서지 정보

| 항목 | 내용 |
|------|------|
| 저자 | {{author}} |
| 출판사 | {{publisher}} |
| 출판년도 | {{publishDate}} |
| ISBN | {{isbn}} |
| 분류 | {{kdcName}} ({{kdcCode}}) |
| 페이지 | {{pages}} |

{{summary}}

{{tableOfContents}}

## 연구 노트

### 주요 논점

### 방법론

### 결론

### 참고 가치

## 인용 정보

{{author}}. ({{publishDate}}). *{{title}}*. {{publisher}}.

{{detailLink}}`
  },
  
  reading: {
    name: '독서 노트 템플릿',
    template: `---
title: "{{title}}"
author: "{{author}}"
genre: book
status: to-read
rating: 
tags: [reading, {{author}}]
created: {{date}}
---

# 📚 {{title}}

{{imagePath}}

> **저자**: {{author}}  
> **출판**: {{publisher}}, {{publishDate}}  
> **ISBN**: {{isbn}}

## 📋 책 소개

{{summary}}

## 📑 목차

{{tableOfContents}}

## 📝 독서 기록

### 🎯 읽는 이유

### 💡 배운 점

### 🤔 생각할 점

### ⭐ 평점 및 추천도

- **평점**: /5
- **추천 여부**: 
- **추천 대상**: 

### 📖 인상 깊은 구절

> 

### 🔖 핵심 키워드

- 
- 
- 

## 🔗 관련 자료

{{detailLink}}

---
*독서 완료일*: `
  }
};
