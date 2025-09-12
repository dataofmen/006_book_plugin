# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Korean Book Search Plugin for Obsidian that integrates with the Korean National Library (국립중앙도서관) Open API to search books and generate structured notes with customizable templates.

## Development Commands

```bash
# Install dependencies
npm install

# Development with auto-rebuild
npm run dev

# Production build
npm run build

# Type checking only
tsc -noEmit -skipLibCheck
```

## Architecture

### Core Structure
- **Plugin Entry**: `src/main.ts` - Main KRBookPlugin class, command registration, note creation logic
- **API Integration**: `src/api/nlk-api.ts` + `types.ts` - Korean National Library API client with search/ISBN endpoints
- **Template Engine**: `src/utils/template.ts` - Handlebars-based note generation with Korean metadata support
- **UI Layer**: `src/ui/search-modal.ts` + `settings-tab.ts` - Search interface and configuration

### Key Integration Points
- **Settings**: `DEFAULT_SETTINGS` in `settings.ts` defines note templates, folder structure, file naming patterns
- **Book Model**: `Book` interface in `types.ts` centralizes Korean library metadata (KDC, DDC classifications, etc.)
- **Template Variables**: Supports `{{title}}`, `{{author}}`, conditional `{{#if ebook}}`, Korean-specific `{{kdc}}`, `{{ddc}}`

### Build System
- **esbuild**: Bundles TypeScript to `main.js` with Obsidian API externals
- **Development**: Watch mode with inline source maps
- **Production**: Minified bundle for distribution

## Plugin Installation for Testing
Copy `main.js`, `manifest.json`, `styles.css` to Obsidian vault's `.obsidian/plugins/kr-book-search/` directory, restart Obsidian.

## API Requirements
Korean National Library Open API key required - configure in plugin settings before use.