import { Plugin, Notice, TFile, normalizePath, Modal } from 'obsidian';
import { KRBookPluginSettings, DEFAULT_SETTINGS } from './settings';
import { BookSearchModal } from './ui/search-modal';
import { KRBookSettingTab } from './ui/settings-tab';
import { Book } from './api/types';
import { BookNoteTemplate } from './utils/template';
import { NationalLibraryAPI } from './api/nlk-api';
import { MultiSiteScraper } from './scraper/multi-site-scraper';

export default class KRBookPlugin extends Plugin {
  settings: KRBookPluginSettings;
  private webScraper: MultiSiteScraper;

  async onload() {
    console.log('Korean Book Search Plugin loading...');

    // 설정 로드
    await this.loadSettings();

    // 웹 스크래퍼 초기화
    this.webScraper = new MultiSiteScraper({
      timeout: 10000,
      retries: 2,
      useCache: true
    });

    // 명령어 등록
    this.addCommand({
      id: 'search-book',
      name: '도서 검색',
      callback: () => {
        if (!this.settings.apiKey) {
          new Notice('먼저 설정에서 API 키를 입력해주세요.');
          return;
        }
        new BookSearchModal(this.app, this).open();
      }
    });

    // 웹 스크래핑 기반 목차 추출 명령어
    this.addCommand({
      id: 'extract-toc-from-web',
      name: '웹에서 목차 추출',
      callback: () => {
        this.showTOCExtractionModal();
      }
    });

    // 선택된 텍스트에서 ISBN/제목 추출하여 목차 추출
    this.addCommand({
      id: 'extract-toc-from-selection',
      name: '선택 텍스트에서 목차 추출',
      editorCallback: (editor) => {
        this.extractTOCFromSelection(editor);
      }
    });


    // 설정 탭 추가
    this.addSettingTab(new KRBookSettingTab(this.app, this));

    // 리본 아이콘 추가 (선택사항)
    this.addRibbonIcon('book', '도서 검색', () => {
      if (!this.settings.apiKey) {
        new Notice('먼저 설정에서 API 키를 입력해주세요.');
        return;
      }
      new BookSearchModal(this.app, this).open();
    });

    console.log('Korean Book Search Plugin loaded');
  }

  onunload() {
    console.log('Korean Book Search Plugin unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * 도서 노트 생성 (개선된 목차 추출 로직 포함)
   */
  async createBookNote(book: Book): Promise<TFile> {
    // 목차 정보 가져오기 (노트 생성 시에만)
    if (!book.tableOfContents ||
        book.tableOfContents === '' ||
        book.tableOfContents === '목차 정보를 찾을 수 없습니다.' ||
        book.tableOfContents === 'ISBN 정보가 없어 목차를 가져올 수 없습니다.' ||
        book.tableOfContents === '목차 정보 로딩 실패') {
      console.log(`📚 [Note] Fetching TOC for: ${book.title}`);
      console.log(`📚 [Note] Book has controlNo: ${book.controlNo || 'None'}`);
      console.log(`📚 [Note] Book has ISBN: ${book.isbn || 'None'}`);

      try {
        // 1순위: 웹 스크래핑으로 목차 추출
        console.log(`🕷️ [Note] Trying web scraping for: ${book.title}`);
        const scrapingResult = await this.webScraper.scrapeTOC(book.isbn || '', book.title);

        if (scrapingResult && scrapingResult.toc.length > 50) {
          book.tableOfContents = scrapingResult.toc;
          console.log(`✅ [Note] TOC obtained via web scraping (${scrapingResult.source}, confidence: ${scrapingResult.confidence}) for: ${book.title}`);
          return await this.createNoteFile(book);
        }

        // 2순위: 기존 API 방법들
        const api = new NationalLibraryAPI(this.settings.apiKey, this.settings.kakaoApiKey);

        // 카카오 통합 설정 적용
        if (this.settings.kakaoApiKey && this.settings.enableKakaoIntegration) {
          api.setKakaoIntegrationSettings(this.settings.enableKakaoIntegration, this.settings.preferKakaoForTOC);
        }

        console.log(`📚 [Note] Trying API methods for: ${book.title}`);
        const tocResult = await api.fetchTableOfContentsWithSession(book);

        if (tocResult.success && tocResult.content) {
          book.tableOfContents = tocResult.content;
          console.log(`✅ [Note] TOC obtained via API (${tocResult.method}) for: ${book.title}`);
          return await this.createNoteFile(book);
        } else {
          console.log(`⚠️ [Note] API TOC extraction failed: ${tocResult.error}`);

          // 3순위: Playwright 시도
          if (book.controlNo) {
            console.log(`📚 [Note] Fallback: Trying Playwright browser automation`);
            const playwrightTOC = await api.fetchTableOfContentsViaPlaywright(book.controlNo);
            if (playwrightTOC) {
              book.tableOfContents = playwrightTOC;
              console.log(`✅ [Note] TOC obtained via Playwright fallback for: ${book.title}`);
              return await this.createNoteFile(book);
            }
          }

          // 4순위: ISBN 검색 시도
          if (book.isbn) {
            console.log(`📚 [Note] Final fallback: Trying ISBN search for: ${book.isbn}`);
            const detailBook = await api.searchByISBN(book.isbn);
            if (detailBook && detailBook.tableOfContents) {
              book.tableOfContents = detailBook.tableOfContents;
              console.log(`✅ [Note] TOC obtained via ISBN fallback for: ${book.title}`);
              return await this.createNoteFile(book);
            }
          }
        }

        // 최종: 목차 없음으로 처리
        book.tableOfContents = '목차 정보를 찾을 수 없습니다.';
        console.log(`⚠️ [Note] No TOC found for: ${book.title}`);

      } catch (error) {
        console.error(`❌ [Note] Failed to get TOC for ${book.title}:`, error);
        book.tableOfContents = '목차 정보 로딩 실패';
      }
    }

    return await this.createNoteFile(book);
  }

  /**
   * 실제 노트 파일 생성
   */
  private async createNoteFile(book: Book): Promise<TFile> {

    // 날짜 포맷팅
    if (book.publishDate) {
      book.publishDate = BookNoteTemplate.formatDate(book.publishDate);
    }
    
    // 가격 포맷팅
    if (book.price) {
      book.price = BookNoteTemplate.formatPrice(book.price);
    }

    // 노트 내용 생성
    const noteContent = BookNoteTemplate.render(this.settings.noteTemplate, book);
    
    // 파일명 생성
    const fileName = BookNoteTemplate.generateFileName(
      this.settings.fileNameTemplate, 
      book
    );
    
    // 폴더 경로 정리
    const folderPath = BookNoteTemplate.normalizeFolderPath(this.settings.noteFolder);
    
    // 폴더 생성 (필요한 경우)
    if (folderPath && this.settings.autoCreateFolder) {
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await this.app.vault.createFolder(folderPath);
      }
    }
    
    // 파일 경로 생성
    const filePath = folderPath 
      ? normalizePath(`${folderPath}/${fileName}.md`)
      : normalizePath(`${fileName}.md`);
    
    // 중복 파일 처리
    let finalPath = filePath;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(finalPath)) {
      const pathWithoutExt = filePath.slice(0, -3); // .md 제거
      finalPath = `${pathWithoutExt}_${counter}.md`;
      counter++;
    }
    
    // 노트 생성
    const file = await this.app.vault.create(finalPath, noteContent);
    
    // 노트 열기 (설정에 따라)
    if (this.settings.openNoteAfterCreation) {
      const leaf = this.app.workspace.getLeaf();
      await leaf.openFile(file);
    }
    
    return file;
  }

  /**
   * 목차 추출 모달 표시
   */
  private async showTOCExtractionModal() {
    const inputModal = new TocExtractionModal(this.app, async (isbn: string, title: string) => {
      await this.extractAndCreateTOCNote(isbn, title);
    });
    inputModal.open();
  }

  /**
   * 선택된 텍스트에서 ISBN/제목 추출하여 목차 추출
   */
  private async extractTOCFromSelection(editor: any) {
    const selection = editor.getSelection();
    if (!selection) {
      new Notice('텍스트를 선택해주세요.');
      return;
    }

    // ISBN 패턴 확인
    const isbnMatch = selection.match(/\b\d{10}(\d{3})?\b/);

    if (isbnMatch) {
      await this.extractAndCreateTOCNote(isbnMatch[0], selection);
    } else {
      // 제목으로 간주하고 검색
      await this.extractAndCreateTOCNote('', selection.trim());
    }
  }

  /**
   * 목차 추출 및 노트 생성
   */
  private async extractAndCreateTOCNote(isbn: string, title: string) {
    const notice = new Notice('도서 목차를 검색하고 있습니다...', 0);

    try {
      const scrapingResult = await this.webScraper.scrapeTOC(isbn, title);

      if (!scrapingResult || !scrapingResult.toc) {
        throw new Error('목차를 찾을 수 없습니다');
      }

      await this.createTOCNote(title || isbn, scrapingResult);
      notice.hide();
      new Notice(`목차 노트가 생성되었습니다! (출처: ${scrapingResult.source})`);

    } catch (error) {
      notice.hide();
      new Notice(`오류: ${error.message}`);
    }
  }

  /**
   * 목차 전용 노트 생성
   */
  private async createTOCNote(identifier: string, scrapingResult: any) {
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = this.sanitizeFileName(`도서목차 - ${identifier} - ${timestamp}`);

    const content = `# ${identifier} - 목차

## 기본 정보
- **출처**: ${scrapingResult.source}
- **신뢰도**: ${scrapingResult.confidence}%
- **추출일**: ${timestamp}

## 목차
${this.formatTOCForNote(scrapingResult.toc)}

---
*추출 방법: 웹 스크래핑*

## 메모


## 관련 링크

`;

    // 폴더 경로 설정
    const folderPath = this.settings.noteFolder || '';
    const filePath = folderPath
      ? normalizePath(`${folderPath}/${fileName}.md`)
      : normalizePath(`${fileName}.md`);

    // 폴더 생성 (필요한 경우)
    if (folderPath && this.settings.autoCreateFolder) {
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await this.app.vault.createFolder(folderPath);
      }
    }

    // 중복 파일 처리
    let finalPath = filePath;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(finalPath)) {
      const pathWithoutExt = filePath.slice(0, -3);
      finalPath = `${pathWithoutExt}_${counter}.md`;
      counter++;
    }

    const file = await this.app.vault.create(finalPath, content);

    // 노트 열기
    if (this.settings.openNoteAfterCreation) {
      const leaf = this.app.workspace.getLeaf();
      await leaf.openFile(file);
    }
  }

  /**
   * 목차를 Obsidian 친화적 형태로 포맷팅
   */
  private formatTOCForNote(toc: string): string {
    return toc
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const trimmed = line.trim();

        // 번호가 있는 항목들을 리스트로 변환
        if (trimmed.match(/^\d+\./)) {
          return `- ${trimmed}`;
        }

        // 장/편/부 등은 헤딩으로
        if (trimmed.match(/(제?\s*\d+\s*[장편부]|Chapter|Part)/i)) {
          return `## ${trimmed}`;
        }

        // 하위 항목들
        if (trimmed.match(/^\d+[-\.]\d+/)) {
          return `  - ${trimmed}`;
        }

        return `- ${trimmed}`;
      })
      .join('\n');
  }

  /**
   * 파일명에서 사용할 수 없는 문자 제거
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * 목차 추출을 위한 간단한 입력 모달
 */
class TocExtractionModal extends Modal {
  private onSubmit: (isbn: string, title: string) => Promise<void>;

  constructor(app: any, onSubmit: (isbn: string, title: string) => Promise<void>) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '웹에서 목차 추출' });

    const form = contentEl.createEl('form');

    // ISBN 입력
    const isbnDiv = form.createEl('div');
    isbnDiv.createEl('label', { text: 'ISBN (선택사항):' });
    const isbnInput = isbnDiv.createEl('input', { type: 'text', placeholder: '9788936431234' });

    // 제목 입력
    const titleDiv = form.createEl('div');
    titleDiv.createEl('label', { text: '도서 제목:' });
    const titleInput = titleDiv.createEl('input', { type: 'text', placeholder: '도서명을 입력하세요' });

    // 버튼 영역
    const buttonDiv = form.createEl('div');
    const submitButton = buttonDiv.createEl('button', { text: '목차 추출', type: 'submit' });
    const cancelButton = buttonDiv.createEl('button', { text: '취소', type: 'button' });

    // 이벤트 핸들러
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const isbn = isbnInput.value.trim();
      const title = titleInput.value.trim();

      if (!isbn && !title) {
        new Notice('ISBN 또는 제목을 입력해주세요.');
        return;
      }

      this.close();
      await this.onSubmit(isbn, title);
    });

    cancelButton.addEventListener('click', () => {
      this.close();
    });

    // 포커스 설정
    titleInput.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
