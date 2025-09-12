export interface KRBookPluginSettings {
  apiKey: string;
  noteFolder: string;
  noteTemplate: string;
  fileNameTemplate: string;
  autoCreateFolder: boolean;
  openNoteAfterCreation: boolean;
  searchResultLimit: number;
}

export const DEFAULT_SETTINGS: KRBookPluginSettings = {
  apiKey: '',
  noteFolder: 'Books',
  noteTemplate: `---
title: "{{title}}"
author: "{{author}}"
publisher: "{{publisher}}"
publishDate: "{{publishDate}}"
isbn: "{{isbn}}"
pages: {{pages}}
price: "{{price}}"
category: "{{subject}}"
tags: [book, {{#if ebook}}ebook{{else}}physical{{/if}}]
created: {{date}}
---

# {{title}}

## 📖 도서 정보

- **저자**: {{author}}
- **출판사**: {{publisher}}
- **출판일**: {{publishDate}}
- **ISBN**: {{isbn}}
- **페이지**: {{pages}}
- **가격**: {{price}}
- **분류**: {{subject}}
{{#if kdc}}- **KDC**: {{kdc}}{{/if}}
{{#if ddc}}- **DDC**: {{ddc}}{{/if}}
{{#if callNumber}}- **청구기호**: {{callNumber}}{{/if}}

{{#if series}}
## 📚 시리즈 정보
- **시리즈명**: {{series}}
{{#if volume}}- **권차**: {{volume}}{{/if}}
{{/if}}

{{#if summary}}
## 📝 책 소개
{{summary}}
{{/if}}

{{#if tableOfContents}}
## 📑 목차
{{tableOfContents}}
{{/if}}

## 🗒️ 메모

## 💭 인용구

## 🔗 관련 링크
{{#if detailLink}}- [국립중앙도서관 상세정보]({{detailLink}}){{/if}}
`,
  fileNameTemplate: '{{title}} - {{author}}',
  autoCreateFolder: true,
  openNoteAfterCreation: true,
  searchResultLimit: 20
};
