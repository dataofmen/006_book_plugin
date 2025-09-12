# 템플릿 예시 모음

## 1. 미니멀 템플릿

```markdown
# {{title}}

- 저자: {{author}}
- 출판: {{publisher}} ({{publishDate}})
- ISBN: {{isbn}}

## 메모
```

## 2. 독서 기록 템플릿

```markdown
---
title: "{{title}}"
author: "{{author}}"
status: "읽기 전"
rating: 
started: 
finished: 
tags: [book, {{subject}}]
---

# {{title}}

## 도서 정보
- **저자**: {{author}}
- **출판사**: {{publisher}}
- **출판일**: {{publishDate}}
- **ISBN**: {{isbn}}
- **페이지**: {{pages}}

## 독서 상태
- [ ] 읽기 시작
- [ ] 읽는 중
- [ ] 완독

## 핵심 내용

## 인상 깊은 구절

## 나의 생각

## 실천 사항
```

## 3. 학술 도서 템플릿

```markdown
---
title: "{{title}}"
type: "학술도서"
author: "{{author}}"
publisher: "{{publisher}}"
year: "{{publishDate}}"
isbn: "{{isbn}}"
kdc: "{{kdc}}"
ddc: "{{ddc}}"
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
| KDC | {{kdc}} |
| DDC | {{ddc}} |
| 청구기호 | {{callNumber}} |

## 연구 주제

## 핵심 이론

## 연구 방법론

## 주요 발견

## 비판적 검토

## 관련 연구

## 인용 문헌
```

## 4. 소설 템플릿

```markdown
---
title: "{{title}}"
author: "{{author}}"
genre: "소설"
series: "{{series}}"
volume: "{{volume}}"
rating: ⭐⭐⭐⭐⭐
---

# {{title}}

{{#if series}}
**시리즈**: {{series}} {{#if volume}}제{{volume}}권{{/if}}
{{/if}}

## 작품 정보
- **작가**: {{author}}
- **출판사**: {{publisher}}
- **출판일**: {{publishDate}}

## 줄거리

## 등장인물

## 주요 사건

## 감상평

## 기억하고 싶은 문장
