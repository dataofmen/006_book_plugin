import { Modal, TextComponent, ButtonComponent, Notice, DropdownComponent, ToggleComponent, SliderComponent } from 'obsidian';
import { NationalLibraryAPI } from './api';
import { BookInfo, SearchOptions, DetailedSearchParams, SearchTarget, Category, SortOption, LicenseType, EnhancementProgress } from './types';
import { SEARCH_PRESETS, CATEGORY_OPTIONS, LICENSE_OPTIONS, SORT_OPTIONS } from './settings';
import KRBookPlugin from './main';

export class BookSearchModal extends Modal {
  private plugin: KRBookPlugin;
  private api: NationalLibraryAPI;
  private searchInput: TextComponent;
  private resultsEl: HTMLElement;
  private searchResults: BookInfo[] = [];
  
  // Advanced search components
  private searchTypeSelect: DropdownComponent;
  private categorySelect: DropdownComponent;
  private licenseSelect: DropdownComponent;
  private sortSelect: DropdownComponent;
  private sortOrderToggle: ToggleComponent;
  private limitSlider: SliderComponent;
  private advancedToggle: ToggleComponent;
  private advancedSection: HTMLElement;
  
  // Detailed search inputs
  private detailedInputs: {
    f1?: DropdownComponent;
    v1?: TextComponent;
    and1?: DropdownComponent;
    f2?: DropdownComponent;
    v2?: TextComponent;
    and2?: DropdownComponent;
    f3?: DropdownComponent;
    v3?: TextComponent;
  } = {};

  private currentSearchOptions: SearchOptions = {};
  private isSearching = false;

  constructor(app: any, plugin: KRBookPlugin) {
    super(app);
    this.plugin = plugin;
    this.api = new NationalLibraryAPI(plugin.settings.apiKey);
    this.modalEl.addClass('kr-book-search-modal');
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    this.createHeader();
    this.createSearchControls();
    this.createAdvancedSearchSection();
    this.createResultsSection();
    
    // 포커스를 검색 입력창에 설정
    setTimeout(() => this.searchInput.inputEl.focus(), 100);
  }

  private createHeader() {
    const { contentEl } = this;
    
    const headerEl = contentEl.createDiv('search-header');
    headerEl.createEl('h2', { text: '📚 한국 도서 검색' });

    // API 상태 표시
    const statusEl = headerEl.createDiv('search-status');
    statusEl.innerHTML = `
      <div style="background: ${this.plugin.settings.apiKey ? '#d4edda' : '#f8d7da'}; 
                  padding: 12px; margin-bottom: 15px; border-radius: 6px; font-size: 14px;
                  border: 1px solid ${this.plugin.settings.apiKey ? '#c3e6cb' : '#f5c6cb'};">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 16px;">${this.plugin.settings.apiKey ? '✅' : '❌'}</span>
          <div>
            <div style="font-weight: 600;">API 상태: ${this.plugin.settings.apiKey ? '연결됨' : 'API 키 없음'}</div>
            <div style="font-size: 12px; opacity: 0.8;">
              목차 추출: ${this.plugin.settings.enableTableOfContents ? '활성화' : '비활성화'} | 
              고급 검색: ${this.plugin.settings.enableAdvancedSearch ? '활성화' : '비활성화'}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private createSearchControls() {
    const { contentEl } = this;
    
    const searchContainer = contentEl.createDiv('search-container');
    
    // 기본 검색 입력
    const inputContainer = searchContainer.createDiv('input-container');
    inputContainer.style.cssText = 'display: flex; gap: 10px; margin-bottom: 15px; align-items: center;';

    this.searchInput = new TextComponent(inputContainer);
    this.searchInput.setPlaceholder('도서명, 저자명, ISBN 또는 키워드 입력');
    this.searchInput.inputEl.style.cssText = 'flex: 1; min-width: 300px;';

    // 검색 버튼들
    const buttonContainer = inputContainer.createDiv('button-container');
    buttonContainer.style.cssText = 'display: flex; gap: 8px;';

    const searchBtn = new ButtonComponent(buttonContainer)
      .setButtonText('🔍 검색')
      .setCta()
      .onClick(() => this.performSearch());

    new ButtonComponent(buttonContainer)
      .setButtonText('📋 목차 검색')
      .onClick(() => this.performTOCSearch());

    new ButtonComponent(buttonContainer)
      .setButtonText('📘 ISBN')
      .onClick(() => this.performISBNSearch());

    // 엔터키 처리
    this.searchInput.inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.isSearching) {
        this.performSearch();
      }
    });

    // 빠른 옵션들
    this.createQuickOptions(searchContainer);
  }

  private createQuickOptions(container: HTMLElement) {
    const quickOptions = container.createDiv('quick-options');
    quickOptions.style.cssText = 'display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap; align-items: center;';

    // 검색 대상
    const searchTargetContainer = quickOptions.createDiv();
    searchTargetContainer.createSpan({ text: '검색 대상: ', cls: 'option-label' });
    
    this.searchTypeSelect = new DropdownComponent(searchTargetContainer);
    Object.entries(SEARCH_PRESETS).forEach(([key, preset]) => {
      this.searchTypeSelect.addOption(key, preset.name);
    });
    this.searchTypeSelect.setValue('general');
    this.searchTypeSelect.onChange((value) => {
      this.currentSearchOptions.searchTarget = SEARCH_PRESETS[value as keyof typeof SEARCH_PRESETS].searchTarget;
      this.updateSearchPlaceholder(value);
    });

    // 카테고리
    const categoryContainer = quickOptions.createDiv();
    categoryContainer.createSpan({ text: '카테고리: ', cls: 'option-label' });
    
    this.categorySelect = new DropdownComponent(categoryContainer);
    CATEGORY_OPTIONS.forEach(option => {
      this.categorySelect.addOption(option.value, option.label);
    });
    this.categorySelect.onChange((value) => {
      this.currentSearchOptions.category = value as Category || undefined;
    });

    // 결과 수 제한
    const limitContainer = quickOptions.createDiv();
    limitContainer.createSpan({ text: '결과 수: ', cls: 'option-label' });
    
    this.limitSlider = new SliderComponent(limitContainer);
    this.limitSlider.setLimits(5, 50, 5);
    this.limitSlider.setValue(this.plugin.settings.searchResultLimit);
    this.limitSlider.setDynamicTooltip();
    this.limitSlider.onChange((value) => {
      this.currentSearchOptions.limit = value;
    });

    // 고급 검색 토글
    if (this.plugin.settings.enableAdvancedSearch) {
      const advancedContainer = quickOptions.createDiv();
      advancedContainer.createSpan({ text: '고급 검색: ', cls: 'option-label' });
      
      this.advancedToggle = new ToggleComponent(advancedContainer);
      this.advancedToggle.onChange((value) => {
        this.toggleAdvancedSearch(value);
      });
    }
  }

  private createAdvancedSearchSection() {
    if (!this.plugin.settings.enableAdvancedSearch) return;

    const { contentEl } = this;
    
    this.advancedSection = contentEl.createDiv('advanced-search');
    this.advancedSection.style.cssText = 'display: none; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px; background: #f9f9f9;';

    const advancedTitle = this.advancedSection.createEl('h3', { text: '🔧 고급 검색 옵션' });
    advancedTitle.style.marginBottom = '15px';

    // 필터 옵션들
    this.createFilterOptions();

    // 상세 검색 조건들
    this.createDetailedSearchInputs();
  }

  private createFilterOptions() {
    const filterContainer = this.advancedSection.createDiv('filter-options');
    filterContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;';

    // 라이센스 옵션
    const licenseContainer = filterContainer.createDiv();
    licenseContainer.createSpan({ text: '이용 제한:', cls: 'filter-label' });
    
    this.licenseSelect = new DropdownComponent(licenseContainer);
    LICENSE_OPTIONS.forEach(option => {
      this.licenseSelect.addOption(option.value, option.label);
    });
    this.licenseSelect.onChange((value) => {
      this.currentSearchOptions.licYn = value as LicenseType || undefined;
    });

    // 정렬 옵션
    const sortContainer = filterContainer.createDiv();
    sortContainer.createSpan({ text: '정렬 기준:', cls: 'filter-label' });
    
    this.sortSelect = new DropdownComponent(sortContainer);
    SORT_OPTIONS.forEach(option => {
      this.sortSelect.addOption(option.value, option.label);
    });
    this.sortSelect.onChange((value) => {
      this.currentSearchOptions.sort = value as SortOption || undefined;
    });

    // 정렬 순서
    const orderContainer = filterContainer.createDiv();
    orderContainer.createSpan({ text: '내림차순:', cls: 'filter-label' });
    
    this.sortOrderToggle = new ToggleComponent(orderContainer);
    this.sortOrderToggle.setValue(true);
    this.sortOrderToggle.onChange((value) => {
      this.currentSearchOptions.desc = value ? 'desc' : 'asc';
    });

    // 정부간행물만
    const govContainer = filterContainer.createDiv();
    govContainer.createSpan({ text: '정부간행물만:', cls: 'filter-label' });
    
    const govToggle = new ToggleComponent(govContainer);
    govToggle.onChange((value) => {
      this.currentSearchOptions.govYn = value ? 'Y' : undefined;
    });
  }

  private createDetailedSearchInputs() {
    const detailContainer = this.advancedSection.createDiv('detailed-search');
    detailContainer.createEl('h4', { text: '상세 검색 조건' });

    // 첫 번째 검색 조건
    this.createSearchConditionRow(detailContainer, 1);
    
    // 두 번째 검색 조건
    this.createSearchConditionRow(detailContainer, 2);
    
    // 세 번째 검색 조건
    this.createSearchConditionRow(detailContainer, 3);
  }

  private createSearchConditionRow(container: HTMLElement, index: number) {
    const rowContainer = container.createDiv(`search-condition-${index}`);
    rowContainer.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap;';

    if (index > 1) {
      // 논리 연산자
      const andSelect = new DropdownComponent(rowContainer);
      andSelect.addOption('AND', 'AND');
      andSelect.addOption('OR', 'OR');
      andSelect.addOption('NOT', 'NOT');
      andSelect.setValue('AND');
      this.detailedInputs[`and${index - 1}` as keyof typeof this.detailedInputs] = andSelect;
      andSelect.selectEl.style.width = '80px';
    }

    // 검색 필드
    const fieldSelect = new DropdownComponent(rowContainer);
    fieldSelect.addOption('total', '전체');
    fieldSelect.addOption('title', '제목');
    fieldSelect.addOption('author', '저자');
    fieldSelect.addOption('publisher', '출판사');
    fieldSelect.addOption('keyword', '키워드');
    fieldSelect.addOption('abs_keyword', '초록');
    fieldSelect.addOption('toc_keyword', '목차');
    this.detailedInputs[`f${index}` as keyof typeof this.detailedInputs] = fieldSelect;
    fieldSelect.selectEl.style.width = '120px';

    // 검색어 입력
    const valueInput = new TextComponent(rowContainer);
    valueInput.setPlaceholder('검색어 입력');
    valueInput.inputEl.style.flex = '1';
    valueInput.inputEl.style.minWidth = '200px';
    this.detailedInputs[`v${index}` as keyof typeof this.detailedInputs] = valueInput;
  }

  private createResultsSection() {
    const { contentEl } = this;
    
    this.resultsEl = contentEl.createDiv('search-results');
    this.resultsEl.style.cssText = 'margin-top: 20px; max-height: 600px; overflow-y: auto;';
  }

  private updateSearchPlaceholder(searchType: string) {
    const preset = SEARCH_PRESETS[searchType as keyof typeof SEARCH_PRESETS];
    if (preset) {
      this.searchInput.setPlaceholder(`${preset.description} - 예: 토지, 박경리, 창비`);
    }
  }

  private toggleAdvancedSearch(show: boolean) {
    if (this.advancedSection) {
      this.advancedSection.style.display = show ? 'block' : 'none';
    }
  }

  async performSearch() {
    if (!this.validateSearch()) return;

    const query = this.searchInput.getValue().trim();
    console.log('🔍 [Modal] Starting general search for:', query);
    
    this.displayLoading('일반 검색');
    this.isSearching = true;

    try {
      // 상세 검색 조건이 있는지 확인
      const hasDetailedConditions = this.hasDetailedSearchConditions();
      
      let results: BookInfo[];
      
      if (hasDetailedConditions) {
        const detailParams = this.buildDetailedSearchParams();
        results = await this.api.detailedSearch(detailParams, this.currentSearchOptions);
      } else {
        results = await this.api.searchBooks(query, this.currentSearchOptions);
      }
      
      this.searchResults = results;
      
      if (results.length === 0) {
        this.displayNoResults(query, '일반 검색');
      } else {
        this.displayResults('일반 검색');
      }
    } catch (error) {
      console.error('❌ [Modal] Search failed:', error);
      this.displayError(error as Error);
    } finally {
      this.isSearching = false;
    }
  }

  async performTOCSearch() {
    if (!this.validateSearch()) return;

    const query = this.searchInput.getValue().trim();
    console.log('📋 [Modal] Starting TOC search for:', query);
    
    this.displayLoading('목차 검색');
    this.isSearching = true;

    try {
      const results = await this.api.searchByTableOfContents(query, this.currentSearchOptions);
      this.searchResults = results;
      
      if (results.length === 0) {
        this.displayNoResults(query, '목차 검색');
      } else {
        this.displayResults('목차 검색');
      }
    } catch (error) {
      console.error('❌ [Modal] TOC search failed:', error);
      this.displayError(error as Error);
    } finally {
      this.isSearching = false;
    }
  }

  async performISBNSearch() {
    const query = this.searchInput.getValue().trim();
    
    // ISBN 형식 검증
    const isbnPattern = /^(?:\d{10}|\d{13}|\d{9}[\dX])$/;
    const cleanISBN = query.replace(/[^\dX]/g, '');
    
    if (!isbnPattern.test(cleanISBN)) {
      new Notice('⚠️ 올바른 ISBN 형식을 입력해주세요 (10자리 또는 13자리)');
      return;
    }

    console.log('📘 [Modal] Starting ISBN search for:', cleanISBN);
    
    this.displayLoading('ISBN 검색');
    this.isSearching = true;

    try {
      const result = await this.api.searchByISBN(cleanISBN);
      
      if (!result) {
        this.displayNoResults(cleanISBN, 'ISBN 검색');
        this.searchResults = [];
      } else {
        this.searchResults = [result];
        this.displayResults('ISBN 검색');
      }
    } catch (error) {
      console.error('❌ [Modal] ISBN search failed:', error);
      this.displayError(error as Error);
    } finally {
      this.isSearching = false;
    }
  }

  private validateSearch(): boolean {
    const query = this.searchInput.getValue().trim();
    
    if (!query) {
      new Notice('⚠️ 검색어를 입력해주세요');
      return false;
    }

    if (!this.plugin.settings.apiKey) {
      new Notice('❌ 설정에서 API 키를 먼저 입력해주세요');
      return false;
    }

    return true;
  }

  private hasDetailedSearchConditions(): boolean {
    return Boolean(
      this.detailedInputs.v1?.getValue().trim() ||
      this.detailedInputs.v2?.getValue().trim() ||
      this.detailedInputs.v3?.getValue().trim()
    );
  }

  private buildDetailedSearchParams(): DetailedSearchParams {
    const params: DetailedSearchParams = {};
    
    if (this.detailedInputs.v1?.getValue().trim()) {
      params.f1 = this.detailedInputs.f1?.getValue() as any;
      params.v1 = this.detailedInputs.v1.getValue().trim();
    }

    if (this.detailedInputs.v2?.getValue().trim()) {
      params.and1 = this.detailedInputs.and1?.getValue() as any;
      params.f2 = this.detailedInputs.f2?.getValue() as any;
      params.v2 = this.detailedInputs.v2.getValue().trim();
    }

    if (this.detailedInputs.v3?.getValue().trim()) {
      params.and2 = this.detailedInputs.and2?.getValue() as any;
      params.f3 = this.detailedInputs.f3?.getValue() as any;
      params.v3 = this.detailedInputs.v3.getValue().trim();
    }

    return params;
  }

  private displayLoading(searchType: string) {
    this.resultsEl.empty();
    const loadingEl = this.resultsEl.createDiv('loading');
    loadingEl.style.cssText = 'text-align: center; padding: 40px;';
    
    loadingEl.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 15px; animation: spin 2s linear infinite;">🔍</div>
      <div style="font-size: 18px; margin-bottom: 10px; font-weight: 600;">${searchType} 진행 중...</div>
      <div style="font-size: 14px; color: #666; margin-bottom: 20px;">
        ${this.plugin.settings.enableTableOfContents ? '도서 정보와 목차를 가져오는 중...' : '도서 정보를 가져오는 중...'}
      </div>
      <div style="background: #f0f0f0; border-radius: 10px; height: 4px; overflow: hidden;">
        <div style="background: #007ACC; height: 100%; width: 30%; animation: loading 1.5s ease-in-out infinite;"></div>
      </div>
    `;

    // CSS 애니메이션 추가
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes loading { 
        0%, 100% { transform: translateX(-100%); }
        50% { transform: translateX(200%); }
      }
    `;
    document.head.appendChild(style);
    setTimeout(() => document.head.removeChild(style), 5000);
  }

  private displayNoResults(query: string, searchType: string) {
    this.resultsEl.empty();
    
    const noResultsEl = this.resultsEl.createDiv('no-results');
    noResultsEl.style.cssText = 'text-align: center; padding: 40px; color: #666;';
    
    noResultsEl.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 20px; opacity: 0.5;">📭</div>
      <div style="font-size: 18px; margin-bottom: 10px; font-weight: 600;">
        "${query}" ${searchType} 결과가 없습니다
      </div>
      <div style="font-size: 14px; color: #999; margin-bottom: 20px;">
        다른 키워드나 검색 옵션을 시도해보세요
      </div>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: left; max-width: 400px; margin: 0 auto;">
        <div style="font-weight: 600; margin-bottom: 8px;">💡 검색 팁:</div>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
          <li>정확한 도서명이나 저자명으로 검색해보세요</li>
          <li>부분 키워드나 유사한 단어로 시도해보세요</li>
          <li>카테고리나 라이센스 필터를 변경해보세요</li>
          <li>ISBN으로 직접 검색해보세요</li>
        </ul>
      </div>
    `;
  }

  private displayError(error: Error) {
    this.resultsEl.empty();
    
    const errorEl = this.resultsEl.createDiv('error');
    errorEl.style.cssText = 'text-align: center; padding: 30px; color: #d73a49; background: #f8f8f8; border-radius: 8px; border: 1px solid #f5c6cb;';
    
    errorEl.innerHTML = `
      <div style="font-size: 32px; margin-bottom: 15px;">❌</div>
      <div style="font-size: 18px; margin-bottom: 10px; font-weight: 600;">검색 중 오류가 발생했습니다</div>
      <div style="font-size: 14px; color: #666; margin-bottom: 20px; background: white; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">
        ${error.message}
      </div>
    `;

    const buttonContainer = errorEl.createDiv();
    buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center;';

    const retryButton = buttonContainer.createEl('button', { cls: 'mod-cta' });
    retryButton.textContent = '🔄 다시 시도';
    retryButton.addEventListener('click', () => this.performSearch());

    const settingsButton = buttonContainer.createEl('button');
    settingsButton.textContent = '⚙️ 설정 확인';
    settingsButton.addEventListener('click', () => {
      this.close();
      // 설정 탭으로 이동하는 로직 추가 가능
    });
  }

  private displayResults(searchType: string) {
    this.resultsEl.empty();
    
    if (this.searchResults.length === 0) {
      this.displayNoResults('', searchType);
      return;
    }

    // 검색 결과 헤더
    const headerEl = this.resultsEl.createEl('div', { cls: 'results-header' });
    headerEl.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0;';
    
    const titleEl = headerEl.createEl('h3');
    titleEl.innerHTML = `📚 ${searchType} 결과 <span style="color: #007ACC;">${this.searchResults.length}권</span>`;
    titleEl.style.margin = '0';

    const statsEl = headerEl.createDiv();
    const enhancedCount = this.searchResults.filter(book => book.tableOfContents || book.summary).length;
    statsEl.innerHTML = `
      <div style="font-size: 12px; color: #666;">
        향상된 정보: ${enhancedCount}권 | 기본 정보: ${this.searchResults.length - enhancedCount}권
      </div>
    `;

    // 결과 컨테이너
    const resultsContainer = this.resultsEl.createDiv('results-container');

    // 각 책 결과 표시
    this.searchResults.forEach((book, index) => {
      this.createBookResultItem(resultsContainer, book, index);
    });
  }

  private createBookResultItem(container: HTMLElement, book: BookInfo, index: number) {
    const bookEl = container.createDiv('book-result');
    bookEl.style.cssText = `
      border: 1px solid #e0e0e0; 
      border-radius: 12px; 
      padding: 20px; 
      margin-bottom: 20px; 
      background: linear-gradient(to bottom, #ffffff, #f8f9fa);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: all 0.2s ease;
    `;

    bookEl.addEventListener('mouseenter', () => {
      bookEl.style.transform = 'translateY(-2px)';
      bookEl.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
    });

    bookEl.addEventListener('mouseleave', () => {
      bookEl.style.transform = 'translateY(0)';
      bookEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    });

    // 제목과 인덱스
    const titleContainer = bookEl.createDiv();
    titleContainer.style.cssText = 'display: flex; align-items: flex-start; gap: 15px; margin-bottom: 15px;';

    const indexEl = titleContainer.createDiv();
    indexEl.textContent = (index + 1).toString();
    indexEl.style.cssText = `
      background: #007ACC; 
      color: white; 
      width: 24px; 
      height: 24px; 
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      font-size: 12px; 
      font-weight: bold;
      flex-shrink: 0;
    `;

    const titleEl = titleContainer.createDiv();
    titleEl.innerHTML = `<strong style="font-size: 16px; color: #1a1a1a;">${book.title || '제목 없음'}</strong>`;
    titleEl.style.flex = '1';

    // 기본 정보
    const infoGrid = bookEl.createDiv();
    infoGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; font-size: 14px;';
    
    const infoItems = [
      { icon: '👤', label: '저자', value: book.author || '저자 미상' },
      { icon: '🏢', label: '출판사', value: book.publisher || '출판사 미상' },
      { icon: '📅', label: '출판일', value: book.publishDate || '미상' },
      { icon: '📘', label: 'ISBN', value: book.isbn || '없음' }
    ];

    if (book.callNo) infoItems.push({ icon: '📍', label: '청구기호', value: book.callNo });
    if (book.kdcName) infoItems.push({ icon: '🏷️', label: '분류', value: book.kdcName });
    if (book.pages) infoItems.push({ icon: '📄', label: '페이지', value: book.pages });
    if (book.bookSize) infoItems.push({ icon: '📏', label: '크기', value: book.bookSize });

    infoItems.forEach(item => {
      const itemEl = infoGrid.createDiv();
      itemEl.innerHTML = `${item.icon} <strong>${item.label}:</strong> ${item.value}`;
      itemEl.style.cssText = 'padding: 4px 0; border-bottom: 1px solid #f0f0f0;';
    });

    // 요약 정보
    if (book.summary && book.summary.length > 20) {
      const summaryEl = bookEl.createDiv();
      summaryEl.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #007ACC;';
      
      const summaryTitle = summaryEl.createDiv();
      summaryTitle.innerHTML = `📝 <strong>도서 소개</strong>`;
      summaryTitle.style.cssText = 'font-size: 13px; font-weight: 600; margin-bottom: 6px;';
      
      const summaryText = summaryEl.createDiv();
      summaryText.textContent = book.summary.length > 200 
        ? book.summary.substring(0, 200) + '...' 
        : book.summary;
      summaryText.style.cssText = 'font-size: 13px; color: #555; line-height: 1.4;';
    }

    // 목차 정보
    if (book.tableOfContents && book.tableOfContents.length > 10) {
      const tocEl = bookEl.createEl('details');
      tocEl.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #f0f8f0; border-radius: 6px; border-left: 4px solid #28a745;';
      
      const summaryEl = tocEl.createEl('summary');
      summaryEl.innerHTML = `📋 <strong>목차 미리보기</strong> <span style="font-size: 11px; color: #666;">(클릭하여 펼치기)</span>`;
      summaryEl.style.cssText = 'cursor: pointer; font-size: 13px; font-weight: 600; margin-bottom: 8px;';
      
      const tocContent = tocEl.createDiv();
      const displayToc = book.tableOfContents.length > 600 
        ? book.tableOfContents.substring(0, 600) + '\n...(더 보기)' 
        : book.tableOfContents;
      
      tocContent.style.cssText = 'font-size: 12px; line-height: 1.5; white-space: pre-line; color: #333; margin-top: 8px; padding-top: 8px; border-top: 1px solid #d4edda;';
      tocContent.textContent = displayToc;
    }

    // 상태 및 추가 정보
    const statusEl = bookEl.createDiv();
    statusEl.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 8px 12px; background: #f8f9fa; border-radius: 6px; font-size: 12px;';
    
    const statusItems: string[] = [];
    if (book.summary) statusItems.push('📝 요약');
    if (book.tableOfContents) statusItems.push('📋 목차');
    if (book.imageUrl) statusItems.push('🖼️ 표지');
    if (book.ebookYn === 'Y') statusItems.push('📱 전자책');
    if (book.cipYn === 'Y') statusItems.push('📋 CIP');
    
    const leftStatus = statusEl.createDiv();
    leftStatus.innerHTML = `<strong>추가 정보:</strong> ${statusItems.length > 0 ? statusItems.join(', ') : '기본 정보만'}`;
    
    const rightStatus = statusEl.createDiv();
    if (book.mediaType) {
      rightStatus.innerHTML = `<strong>매체:</strong> ${book.mediaType}`;
    }

    // 노트 생성 버튼
    const buttonContainer = bookEl.createDiv();
    buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

    if (book.detailLink) {
      const linkBtn = buttonContainer.createEl('button');
      linkBtn.textContent = '🔗 상세정보';
      linkBtn.className = 'mod-muted';
      linkBtn.addEventListener('click', () => {
        const fullLink = book.detailLink!.startsWith('http') ? book.detailLink! : `https://www.nl.go.kr${book.detailLink}`;
        window.open(fullLink, '_blank');
      });
    }

    const createNoteBtn = buttonContainer.createEl('button');
    createNoteBtn.textContent = '📝 노트 생성';
    createNoteBtn.className = 'mod-cta';
    createNoteBtn.addEventListener('click', async () => {
      await this.createBookNote(book, createNoteBtn);
    });
  }

  private async createBookNote(book: BookInfo, button: HTMLButtonElement) {
    try {
      const originalText = button.textContent;
      button.textContent = '📝 생성 중...';
      button.disabled = true;
      
      await this.plugin.createBookNote(book);
      
      new Notice(`✅ "${book.title}" 노트가 생성되었습니다`);
      
      // 성공 표시
      button.textContent = '✅ 완료';
      button.style.backgroundColor = '#28a745';
      button.style.color = 'white';
      
      setTimeout(() => {
        button.textContent = originalText!;
        button.disabled = false;
        button.style.backgroundColor = '';
        button.style.color = '';
      }, 2000);
      
      // 설정에 따라 모달 닫기
      if (this.plugin.settings.openNoteAfterCreation) {
        setTimeout(() => this.close(), 1000);
      }
    } catch (error) {
      console.error('❌ [Modal] Note creation failed:', error);
      new Notice(`❌ 노트 생성 실패: ${(error as Error).message}`);
      
      button.textContent = '❌ 실패';
      button.style.backgroundColor = '#dc3545';
      button.style.color = 'white';
      
      setTimeout(() => {
        button.textContent = '📝 노트 생성';
        button.disabled = false;
        button.style.backgroundColor = '';
        button.style.color = '';
      }, 3000);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
