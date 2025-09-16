import { App, Modal, Notice, TextComponent, ButtonComponent, Setting } from 'obsidian';
import { NationalLibraryAPI } from '../api/nlk-api';
import { Book } from '../api/types';
import KRBookPlugin from '../main';

export class BookSearchModal extends Modal {
  private api: NationalLibraryAPI;
  private plugin: KRBookPlugin;
  private searchResults: Book[] = [];
  private searchInput: TextComponent;
  private resultsContainer: HTMLElement;
  private paginationContainer: HTMLElement;
  private currentPage = 1;
  private totalResults = 0;
  public searchType: 'keyword' = 'keyword';
  private isSearching = false;

  constructor(app: App, plugin: KRBookPlugin) {
    super(app);
    this.plugin = plugin;
    this.api = new NationalLibraryAPI(plugin.settings.apiKey);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('kr-book-search-modal');

    // 모달 크기 설정
    this.modalEl.style.width = '60vw';
    this.modalEl.style.maxWidth = '700px';
    this.modalEl.style.height = '60vh';
    this.modalEl.style.maxHeight = '500px';
    this.modalEl.style.minHeight = '400px';

    // 제목
    contentEl.createEl('h2', { text: '📚 도서 검색' });

    // 검색 방식 안내 (키워드 검색만 제공)
    const searchInfoContainer = contentEl.createDiv('search-info-container');
    searchInfoContainer.createEl('p', { 
      text: '🔍 키워드 검색 - 제목, 저자, 출판사를 통합 검색합니다',
      cls: 'search-info-text'
    });

    // 검색 입력
    const searchContainer = contentEl.createDiv('search-container');
    
    this.searchInput = new TextComponent(searchContainer)
      .setPlaceholder('검색어를 입력하세요...');
    this.searchInput.inputEl.addClass('search-input');
    
    // Enter 키 이벤트
    this.searchInput.inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.isSearching) {
        this.performSearch();
      }
    });

    // 검색 버튼
    new ButtonComponent(searchContainer)
      .setButtonText('🔍 검색')
      .setCta()
      .onClick(() => this.performSearch());

    // 고급 검색 옵션 (접혀있음)
    this.createAdvancedSearchOptions(contentEl);

    // 결과 컨테이너
    this.resultsContainer = contentEl.createDiv('search-results');
    
    // 페이지네이션
    this.paginationContainer = contentEl.createDiv('pagination');

    // 초기 플레이스홀더 설정
    this.updateSearchPlaceholder();
  }

  private createAdvancedSearchOptions(container: HTMLElement) {
    const advancedContainer = container.createDiv('advanced-search');
    
    const toggleButton = advancedContainer.createEl('button', {
      text: '🔧 고급 검색 옵션',
      cls: 'advanced-toggle'
    });

    const optionsContainer = advancedContainer.createDiv('advanced-options');
    optionsContainer.style.display = 'none';

    toggleButton.addEventListener('click', () => {
      const isHidden = optionsContainer.style.display === 'none';
      optionsContainer.style.display = isHidden ? 'block' : 'none';
      toggleButton.textContent = isHidden ? '🔧 고급 검색 옵션 숨기기' : '🔧 고급 검색 옵션';
    });

    // 정렬 옵션
    new Setting(optionsContainer)
      .setName('정렬 기준')
      .addDropdown(dropdown => {
        dropdown
          .addOption('relevance', '관련도순')
          .addOption('title', '제목순')
          .addOption('author', '저자순')
          .addOption('pub_year', '출간년도순')
          .setValue('relevance');
        this.sortOption = dropdown;
      });

    // 정렬 순서
    new Setting(optionsContainer)
      .setName('정렬 순서')
      .addDropdown(dropdown => {
        dropdown
          .addOption('desc', '내림차순')
          .addOption('asc', '오름차순')
          .setValue('desc');
        this.orderOption = dropdown;
      });
  }

  private updateSearchPlaceholder() {
    this.searchInput.setPlaceholder('🔍 제목, 저자, 출판사 등을 입력하세요 (예: 토지, 박경리, 창비)');
  }

  private async performSearch() {
    if (this.isSearching) {
      return;
    }

    const query = this.searchInput.getValue().trim();
    if (!query) {
      new Notice('⚠️ 검색어를 입력해주세요.');
      return;
    }

    this.isSearching = true;
    this.resultsContainer.empty();
    
    // 로딩 표시
    const loadingEl = this.resultsContainer.createEl('div', { 
      cls: 'loading-container' 
    });
    loadingEl.createEl('div', { text: '🔍 검색 중...', cls: 'loading-text' });
    loadingEl.createEl('div', { text: `"${query}" 관련 도서를 찾고 있습니다.`, cls: 'loading-subtext' });

    try {
      console.log(`🔍 Starting keyword search: "${query}"`);
      
      // 키워드 검색만 제공
      const searchParams = {
        query,
        pageNum: this.currentPage,
        pageSize: this.plugin.settings.searchResultLimit,
        sort: this.sortOption?.getValue() as any,
        order: this.orderOption?.getValue() as any
      };

      this.searchResults = await this.api.searchBooks(searchParams);
      this.totalResults = this.searchResults.length;
      console.log(`✅ Keyword search found ${this.totalResults} books`);

      this.displayResults();
    } catch (error) {
      console.error('❌ Search error:', error);
      this.resultsContainer.empty();
      
      const errorContainer = this.resultsContainer.createEl('div', { cls: 'error-container' });
      errorContainer.createEl('div', { text: '❌ 검색 중 오류가 발생했습니다', cls: 'error-title' });
      errorContainer.createEl('div', { text: error.message, cls: 'error-message' });
      
      // 다시 시도 버튼
      new ButtonComponent(errorContainer)
        .setButtonText('🔄 다시 시도')
        .onClick(() => this.performSearch());

      new Notice('❌ 검색 실패: ' + error.message);
    } finally {
      this.isSearching = false;
    }
  }

  private displayResults() {
    this.resultsContainer.empty();

    if (this.searchResults.length === 0) {
      const noResultsContainer = this.resultsContainer.createEl('div', { cls: 'no-results-container' });
      noResultsContainer.createEl('div', { text: '📭 검색 결과가 없습니다', cls: 'no-results-title' });
      noResultsContainer.createEl('div', { text: '다른 키워드로 검색해보세요.', cls: 'no-results-suggestion' });
      
      return;
    }

    // 결과 헤더
    const resultsHeader = this.resultsContainer.createEl('div', { cls: 'results-header' });
    resultsHeader.createEl('h3', { 
      text: `📚 검색 결과 (${this.searchResults.length}권)`,
      cls: 'results-title'
    });

    // 검색 결과 표시
    this.searchResults.forEach((book, index) => {
      const resultItem = this.resultsContainer.createDiv('result-item');
      
      // 순번 표시
      const indexEl = resultItem.createEl('div', { 
        text: `${index + 1}`,
        cls: 'result-index'
      });

      // 도서 정보 표시
      const bookInfo = resultItem.createDiv('book-info');
      
      // 제목
      if (book.title) {
        bookInfo.createEl('h4', { 
          text: book.title,
          cls: 'book-title'
        });
      }
      
      // 상세 정보
      const details = bookInfo.createDiv('book-details');
      
      if (book.author) {
        const authorEl = details.createEl('div', { cls: 'book-detail-row' });
        authorEl.createEl('span', { text: '👤 저자: ', cls: 'detail-label' });
        authorEl.createEl('span', { text: book.author, cls: 'detail-value' });
      }
      
      if (book.publisher) {
        const publisherEl = details.createEl('div', { cls: 'book-detail-row' });
        publisherEl.createEl('span', { text: '🏢 출판사: ', cls: 'detail-label' });
        publisherEl.createEl('span', { text: book.publisher, cls: 'detail-value' });
      }
      
      if (book.publishDate) {
        const dateEl = details.createEl('div', { cls: 'book-detail-row' });
        dateEl.createEl('span', { text: '📅 출판일: ', cls: 'detail-label' });
        dateEl.createEl('span', { text: book.publishDate, cls: 'detail-value' });
      }
      
      if (book.isbn) {
        const isbnEl = details.createEl('div', { cls: 'book-detail-row' });
        isbnEl.createEl('span', { text: '📘 ISBN: ', cls: 'detail-label' });
        isbnEl.createEl('span', { text: book.isbn, cls: 'detail-value detail-isbn' });
      }

      // 추가 정보
      const extraInfo = details.createDiv('book-extra-info');
      
      if (book.pages) {
        extraInfo.createEl('span', { text: `📄 ${book.pages}쪽`, cls: 'extra-tag' });
      }
      
      if (book.price) {
        extraInfo.createEl('span', { text: `💰 ${book.price}`, cls: 'extra-tag' });
      }
      
      if (book.ebook) {
        extraInfo.createEl('span', { text: '💻 전자책', cls: 'extra-tag ebook-tag' });
      }

      // 카카오 통합 정보 표시
      if (book.hasKakaoData) {
        extraInfo.createEl('span', { text: '🥕 카카오 연동', cls: 'extra-tag kakao-tag' });

        // 카카오 가격 정보 (할인가가 있는 경우)
        if (book.kakaoSalePrice && book.kakaoPrice && book.kakaoSalePrice < book.kakaoPrice) {
          extraInfo.createEl('span', {
            text: `💰 ${book.kakaoSalePrice.toLocaleString()}원 (할인)`,
            cls: 'extra-tag price-sale-tag'
          });
        } else if (book.kakaoPrice) {
          extraInfo.createEl('span', {
            text: `💰 ${book.kakaoPrice.toLocaleString()}원`,
            cls: 'extra-tag price-tag'
          });
        }
      }

      // 액션 버튼들
      const actions = resultItem.createDiv('book-actions');
      
      // 노트 생성 버튼
      new ButtonComponent(actions)
        .setButtonText('📝 노트 생성')
        .setCta()
        .onClick(async () => {
          await this.createBookNote(book);
        });

    });

    this.updatePagination();
  }

  private updatePagination() {
    this.paginationContainer.empty();
    
    if (this.totalResults <= this.plugin.settings.searchResultLimit) {
      return;
    }

    const totalPages = Math.ceil(this.totalResults / this.plugin.settings.searchResultLimit);
    const paginationEl = this.paginationContainer.createDiv('pagination-controls');
    
    if (this.currentPage > 1) {
      new ButtonComponent(paginationEl)
        .setButtonText('⬅️ 이전')
        .onClick(() => {
          this.currentPage--;
          this.performSearch();
        });
    }

    paginationEl.createEl('span', { 
      text: `📄 ${this.currentPage} / ${totalPages}`,
      cls: 'page-info'
    });

    if (this.currentPage < totalPages) {
      new ButtonComponent(paginationEl)
        .setButtonText('다음 ➡️')
        .onClick(() => {
          this.currentPage++;
          this.performSearch();
        });
    }
  }

  private async createBookNote(book: Book) {
    try {
      console.log('📝 Creating note for book:', book.title);
      
      // 로딩 표시
      const notice = new Notice('📝 노트를 생성하는 중...', 0);
      
      await this.plugin.createBookNote(book);
      
      notice.hide();
      this.close();
      
      new Notice(`✅ "${book.title}" 노트가 생성되었습니다.`, 5000);
    } catch (error) {
      console.error('❌ Note creation error:', error);
      new Notice('❌ 노트 생성 실패: ' + error.message);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }


  // 고급 검색 옵션 참조
  private sortOption: any;
  private orderOption: any;
}
