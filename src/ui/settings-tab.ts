import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import KRBookPlugin from '../main';
import { NationalLibraryAPI } from '../api/nlk-api';

export class KRBookSettingTab extends PluginSettingTab {
  plugin: KRBookPlugin;

  constructor(app: App, plugin: KRBookPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: '한국 도서 검색 플러그인 설정' });

    // API 키 설정
    new Setting(containerEl)
      .setName('국립중앙도서관 API 키')
      .setDesc('국립중앙도서관 Open API 인증키를 입력하세요.')
      .addText(text => text
        .setPlaceholder('API 키 입력')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        }))
      .addButton(button => button
        .setButtonText('키 확인')
        .onClick(async () => {
          if (!this.plugin.settings.apiKey) {
            new Notice('API 키를 먼저 입력해주세요.');
            return;
          }
          
          const api = new NationalLibraryAPI(this.plugin.settings.apiKey);
          const isValid = await api.validateApiKey();
          
          if (isValid) {
            new Notice('API 키가 유효합니다.');
          } else {
            new Notice('API 키가 유효하지 않습니다. 다시 확인해주세요.');
          }
        }));

    // API 키 발급 안내
    containerEl.createDiv('setting-item-description').innerHTML = 
      'API 키는 <a href="https://www.nl.go.kr/NL/contents/N31101030700.do">국립중앙도서관 Open API</a>에서 발급받을 수 있습니다.';

    // 노트 폴더 설정
    new Setting(containerEl)
      .setName('노트 저장 폴더')
      .setDesc('도서 노트가 저장될 폴더 경로를 설정합니다.')
      .addText(text => text
        .setPlaceholder('예: Books')
        .setValue(this.plugin.settings.noteFolder)
        .onChange(async (value) => {
          this.plugin.settings.noteFolder = value;
          await this.plugin.saveSettings();
        }));

    // 폴더 자동 생성
    new Setting(containerEl)
      .setName('폴더 자동 생성')
      .setDesc('존재하지 않는 폴더를 자동으로 생성합니다.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoCreateFolder)
        .onChange(async (value) => {
          this.plugin.settings.autoCreateFolder = value;
          await this.plugin.saveSettings();
        }));

    // 노트 생성 후 열기
    new Setting(containerEl)
      .setName('노트 생성 후 자동 열기')
      .setDesc('노트를 생성한 후 자동으로 엽니다.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.openNoteAfterCreation)
        .onChange(async (value) => {
          this.plugin.settings.openNoteAfterCreation = value;
          await this.plugin.saveSettings();
        }));

    // 검색 결과 제한
    new Setting(containerEl)
      .setName('검색 결과 표시 개수')
      .setDesc('한 번에 표시할 검색 결과의 최대 개수를 설정합니다.')
      .addSlider(slider => slider
        .setLimits(5, 50, 5)
        .setValue(this.plugin.settings.searchResultLimit)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.searchResultLimit = value;
          await this.plugin.saveSettings();
        }));

    // 파일명 템플릿
    new Setting(containerEl)
      .setName('파일명 템플릿')
      .setDesc('노트 파일명 형식을 설정합니다. 사용 가능한 변수: {{title}}, {{author}}, {{publisher}}, {{isbn}}')
      .addText(text => text
        .setPlaceholder('{{title}} - {{author}}')
        .setValue(this.plugin.settings.fileNameTemplate)
        .onChange(async (value) => {
          this.plugin.settings.fileNameTemplate = value;
          await this.plugin.saveSettings();
        }));

    // 노트 템플릿 설정
    containerEl.createEl('h3', { text: '노트 템플릿' });
    
    const templateDesc = containerEl.createDiv('setting-item-description');
    templateDesc.innerHTML = `
      <p>도서 노트 생성 시 사용할 템플릿을 설정합니다.</p>
      <details>
        <summary>사용 가능한 변수 목록</summary>
        <ul>
          <li>{{title}} - 도서 제목</li>
          <li>{{author}} - 저자</li>
          <li>{{publisher}} - 출판사</li>
          <li>{{publishDate}} - 출판일</li>
          <li>{{isbn}} - ISBN</li>
          <li>{{pages}} - 페이지 수</li>
          <li>{{price}} - 가격</li>
          <li>{{subject}} - 주제/분류</li>
          <li>{{kdc}} - 한국십진분류</li>
          <li>{{ddc}} - 듀이십진분류</li>
          <li>{{callNumber}} - 청구기호</li>
          <li>{{series}} - 시리즈명</li>
          <li>{{volume}} - 권차</li>
          <li>{{summary}} - 책 소개</li>
          <li>{{tableOfContents}} - 목차</li>
          <li>{{date}} - 현재 날짜</li>
        </ul>
      </details>
    `;

    new Setting(containerEl)
      .setClass('template-setting')
      .addTextArea(text => {
        text
          .setPlaceholder('노트 템플릿 입력...')
          .setValue(this.plugin.settings.noteTemplate)
          .onChange(async (value) => {
            this.plugin.settings.noteTemplate = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 20;
        text.inputEl.cols = 60;
      });

    // 템플릿 초기화 버튼
    new Setting(containerEl)
      .addButton(button => button
        .setButtonText('템플릿 초기화')
        .setWarning()
        .onClick(async () => {
          const { DEFAULT_SETTINGS } = await import('../settings');
          this.plugin.settings.noteTemplate = DEFAULT_SETTINGS.noteTemplate;
          await this.plugin.saveSettings();
          this.display(); // 화면 새로고침
          new Notice('템플릿이 기본값으로 초기화되었습니다.');
        }));
  }
}
