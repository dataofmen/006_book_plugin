import { Plugin, Notice, normalizePath, moment, TFile } from 'obsidian';
import { BookInfo, PluginSettings } from './types';
import { DEFAULT_SETTINGS } from './settings';
import { BookSearchModal } from './modal';
import { KRBookSettingTab } from './setting-tab';

export default class KRBookPlugin extends Plugin {
  settings: PluginSettings;

  async onload() {
    console.log('📚 [Plugin] Korean Book Search Plugin loading...');
    
    await this.loadSettings();

    // 명령어 등록
    this.addCommand({
      id: 'search-books',
      name: '도서 검색',
      callback: () => {
        this.openSearchModal();
      }
    });

    // 리본 아이콘 추가
    this.addRibbonIcon('book', '도서 검색', () => {
      this.openSearchModal();
    });

    // 설정 탭 추가
    this.addSettingTab(new KRBookSettingTab(this.app, this));

    console.log('✅ [Plugin] Korean Book Search Plugin loaded successfully');
  }

  onunload() {
    console.log('👋 [Plugin] Korean Book Search Plugin unloading...');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private openSearchModal() {
    if (!this.settings.apiKey) {
      new Notice('❌ 먼저 설정에서 API 키를 입력해주세요');
      return;
    }
    
    new BookSearchModal(this.app, this).open();
  }

  async createBookNote(book: BookInfo): Promise<TFile> {
    console.log('📝 [Plugin] Creating note for:', book.title);

    try {
      // 노트 내용 생성
      const noteContent = await this.generateNoteContent(book);

      // 파일명 생성
      const fileName = this.generateFileName(book);

      // 폴더 생성 (필요시)
      if (this.settings.noteFolder && this.settings.autoCreateFolder) {
        const folderExists = this.app.vault.getAbstractFileByPath(this.settings.noteFolder);
        if (!folderExists) {
          await this.app.vault.createFolder(this.settings.noteFolder);
          console.log('📁 [Plugin] Created folder:', this.settings.noteFolder);
        }
      }

      // 파일 경로 생성
      const filePath = this.settings.noteFolder 
        ? normalizePath(`${this.settings.noteFolder}/${fileName}.md`)
        : normalizePath(`${fileName}.md`);

      // 파일 생성
      const file = await this.app.vault.create(filePath, noteContent);
      console.log('✅ [Plugin] Note created:', filePath);

      // 노트 열기 (옵션이 활성화된 경우)
      if (this.settings.openNoteAfterCreation) {
        const leaf = this.app.workspace.getLeaf();
        await leaf.openFile(file);
      }

      return file;
    } catch (error) {
      console.error('❌ [Plugin] Failed to create note:', error);
      throw error;
    }
  }

  private async generateNoteContent(book: BookInfo): Promise<string> {
    let content = this.settings.noteTemplate;

    // 템플릿 변수 치환
    const replacements: Record<string, string> = {
      '{{title}}': book.title || '',
      '{{author}}': book.author || '',
      '{{publisher}}': book.publisher || '',
      '{{publishDate}}': book.publishDate || '',
      '{{isbn}}': book.isbn || '',
      '{{date}}': moment().format('YYYY-MM-DD'),
      '{{callNo}}': book.callNo ? `- **청구기호**: ${book.callNo}` : '',
      '{{kdcName}}': book.kdcName ? `- **분류**: ${book.kdcName}` : '',
      '{{summary}}': book.summary ? this.formatSummary(book.summary) : '',
      '{{tableOfContents}}': book.tableOfContents ? this.formatTableOfContents(book.tableOfContents) : '',
      '{{detailLink}}': book.detailLink ? this.formatDetailLink(book.detailLink) : '',
      '{{imagePath}}': book.imageUrl ? this.formatImagePath(book.imageUrl) : ''
    };

    // 변수 치환
    for (const [placeholder, value] of Object.entries(replacements)) {
      while (content.includes(placeholder)) {
        content = content.replace(placeholder, value);
      }
    }

    return content;
  }

  private formatSummary(summary: string): string {
    if (!summary || summary.length < 10) return '';
    
    return `## 📝 책 소개

${summary}`;
  }

  private formatTableOfContents(toc: string): string {
    if (!toc || toc.length < 10) return '';
    
    return `## 📁 목차

${toc}`;
  }

  private formatDetailLink(detailLink: string): string {
    if (!detailLink) return '';
    
    const fullLink = detailLink.startsWith('http') 
      ? detailLink 
      : `https://www.nl.go.kr${detailLink}`;
    
    return `- [국립중앙도서관 상세정보](${fullLink})`;
  }

  private formatImagePath(imageUrl: string): string {
    if (!imageUrl) return '';
    
    // 향후 이미지 다운로드 기능을 위한 준비
    // 현재는 단순히 링크만 제공
    return `![표지](${imageUrl})`;
  }

  private generateFileName(book: BookInfo): string {
    let fileName = this.settings.fileNameTemplate;
    
    // 기본 변수 치환
    fileName = fileName.replace('{{title}}', book.title || 'Unknown Title');
    fileName = fileName.replace('{{author}}', book.author || 'Unknown Author');
    fileName = fileName.replace('{{publishDate}}', book.publishDate || '');
    fileName = fileName.replace('{{isbn}}', book.isbn || '');
    
    // 파일명에서 사용할 수 없는 문자 제거
    fileName = fileName.replace(/[\\/:*?"<>|]/g, '-');
    fileName = fileName.replace(/\s+/g, ' ');
    fileName = fileName.trim();
    
    // 너무 긴 파일명 제한
    if (fileName.length > 200) {
      fileName = fileName.substring(0, 200);
    }
    
    return fileName;
  }
}
