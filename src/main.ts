import { Plugin, Notice, TFile, normalizePath, Modal } from 'obsidian';
import { KRBookPluginSettings, DEFAULT_SETTINGS } from './settings';
import { BookSearchModal } from './ui/search-modal';
import { KRBookSettingTab } from './ui/settings-tab';
import { Book } from './api/types';
import { BookNoteTemplate } from './utils/template';
import { NationalLibraryAPI } from './api/nlk-api';

export default class KRBookPlugin extends Plugin {
  settings: KRBookPluginSettings;

  async onload() {
    console.log('Korean Book Search Plugin loading...');

    // 설정 로드
    await this.loadSettings();


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
   * 도서 노트 생성
   */
  async createBookNote(book: Book): Promise<TFile> {
    console.log(`📚 [Note] Creating note for: ${book.title}`);
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

}

