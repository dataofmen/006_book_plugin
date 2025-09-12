import { PluginSettingTab, Setting } from 'obsidian';
import KRBookPlugin from './main';

export class KRBookSettingTab extends PluginSettingTab {
  plugin: KRBookPlugin;

  constructor(app: any, plugin: KRBookPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: '📚 한국 도서 검색 플러그인 설정' });

    // API 키 설정
    new Setting(containerEl)
      .setName('국립중앙도서관 API 키')
      .setDesc('국립중앙도서관 Open API 인증키를 입력하세요. 키 발급: https://www.nl.go.kr/seoji/contents/S80100000000.do')
      .addText(text => text
        .setPlaceholder('API 키 입력')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        }));

    // 노트 저장 폴더
    new Setting(containerEl)
      .setName('노트 저장 폴더')
      .setDesc('도서 노트가 저장될 폴더 경로 (비어있으면 루트)')
      .addText(text => text
        .setPlaceholder('예: Books, _References')
        .setValue(this.plugin.settings.noteFolder)
        .onChange(async (value) => {
          this.plugin.settings.noteFolder = value;
          await this.plugin.saveSettings();
        }));

    // 파일명 템플릿
    new Setting(containerEl)
      .setName('파일명 템플릿')
      .setDesc('생성될 노트의 파일명 형식')
      .addText(text => text
        .setPlaceholder('{{title}} - {{author}}')
        .setValue(this.plugin.settings.fileNameTemplate)
        .onChange(async (value) => {
          this.plugin.settings.fileNameTemplate = value;
          await this.plugin.saveSettings();
        }));

    // 검색 결과 제한
    new Setting(containerEl)
      .setName('검색 결과 개수')
      .setDesc('한 번에 가져올 최대 검색 결과 수')
      .addSlider(slider => slider
        .setLimits(5, 50, 5)
        .setValue(this.plugin.settings.searchResultLimit)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.searchResultLimit = value;
          await this.plugin.saveSettings();
        }));

    // 폴더 자동 생성
    new Setting(containerEl)
      .setName('폴더 자동 생성')
      .setDesc('지정한 폴더가 없으면 자동으로 생성합니다')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoCreateFolder)
        .onChange(async (value) => {
          this.plugin.settings.autoCreateFolder = value;
          await this.plugin.saveSettings();
        }));

    // 노트 자동 열기
    new Setting(containerEl)
      .setName('노트 자동 열기')
      .setDesc('노트 생성 후 자동으로 열기')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.openNoteAfterCreation)
        .onChange(async (value) => {
          this.plugin.settings.openNoteAfterCreation = value;
          await this.plugin.saveSettings();
        }));

    // 목차 추출 활성화
    new Setting(containerEl)
      .setName('목차 추출 시도')
      .setDesc('ISBN 서지정보 API를 통해 목차 정보를 가져오려고 시도합니다 (실험적 기능)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableTableOfContents)
        .onChange(async (value) => {
          this.plugin.settings.enableTableOfContents = value;
          await this.plugin.saveSettings();
        }));

    // 노트 템플릿 설정
    containerEl.createEl('h3', { text: '📝 노트 템플릿 설정' });
    
    const templateDesc = containerEl.createEl('p');
    templateDesc.innerHTML = `
      사용 가능한 변수:<br>
      <code>{{title}}</code> - 도서 제목<br>
      <code>{{author}}</code> - 저자<br>
      <code>{{publisher}}</code> - 출판사<br>
      <code>{{publishDate}}</code> - 출판일<br>
      <code>{{isbn}}</code> - ISBN<br>
      <code>{{date}}</code> - 노트 생성일<br>
      <code>{{callNo}}</code> - 청구기호 (있는 경우)<br>
      <code>{{kdcName}}</code> - 분류명 (있는 경우)<br>
      <code>{{summary}}</code> - 도서 소개 (있는 경우)<br>
      <code>{{tableOfContents}}</code> - 목차 (있는 경우)<br>
      <code>{{detailLink}}</code> - 상세 정보 링크<br>
      <code>{{imagePath}}</code> - 표지 이미지 (향후 지원 예정)
    `;
    templateDesc.style.fontSize = '14px';
    templateDesc.style.color = '#666';
    templateDesc.style.marginBottom = '10px';

    new Setting(containerEl)
      .setName('노트 템플릿')
      .setDesc('생성될 노트의 내용 템플릿')
      .addTextArea(text => {
        text
          .setValue(this.plugin.settings.noteTemplate)
          .onChange(async (value) => {
            this.plugin.settings.noteTemplate = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 20;
        text.inputEl.style.width = '100%';
        text.inputEl.style.fontFamily = 'monospace';
        text.inputEl.style.fontSize = '12px';
      });

    // 사용 안내
    containerEl.createEl('h3', { text: '📖 사용 안내' });
    
    const usageEl = containerEl.createDiv();
    usageEl.style.padding = '15px';
    usageEl.style.backgroundColor = '#f0f8ff';
    usageEl.style.borderRadius = '8px';
    usageEl.style.marginTop = '10px';
    
    usageEl.innerHTML = `
      <h4>🔍 검색 방법</h4>
      <ul>
        <li><strong>일반 검색:</strong> 도서명, 저자명, 출판사 등으로 검색</li>
        <li><strong>목차 검색:</strong> 목차에 포함된 키워드로 도서 검색</li>
      </ul>
      
      <h4>📋 목차 추출 정보</h4>
      <ul>
        <li>국립중앙도서관의 ISBN 서지정보 API를 활용</li>
        <li>목차 URL이 제공된 도서에 한해 추출 시도</li>
        <li>HTML 파싱을 통한 목차 정보 자동 추출</li>
        <li>추출 실패 시 기본 정보만으로 노트 생성</li>
      </ul>
      
      <h4>🔗 유용한 링크</h4>
      <ul>
        <li><a href="https://www.nl.go.kr/seoji/contents/S80100000000.do">API 키 발급</a></li>
        <li><a href="https://www.nl.go.kr/NL/contents/search.do">국립중앙도서관 검색</a></li>
      </ul>
    `;

    // 디버그 정보
    const debugEl = containerEl.createDiv();
    debugEl.style.marginTop = '20px';
    debugEl.style.padding = '10px';
    debugEl.style.backgroundColor = '#f8f9fa';
    debugEl.style.borderRadius = '4px';
    debugEl.style.fontSize = '12px';
    debugEl.style.color = '#666';
    
    debugEl.innerHTML = `
      <strong>디버그 정보:</strong><br>
      API 키: ${this.plugin.settings.apiKey ? '설정됨 ✅' : '미설정 ❌'}<br>
      목차 추출: ${this.plugin.settings.enableTableOfContents ? '활성화 ✅' : '비활성화 ❌'}<br>
      검색 제한: ${this.plugin.settings.searchResultLimit}건
    `;
  }
}
