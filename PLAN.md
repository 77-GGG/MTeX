# MTeX - macOS 笔记本应用实现方案

## Context

开发一款跨平台桌面笔记本应用，支持 Markdown 和 LaTeX 双格式编辑，具备强大的全文搜索与笔记索引功能。采用文档型笔记模式（类似 Obsidian/Typora），笔记文件存储在本地文件系统，元数据和全文索引存储在 SQLite 中。

---

## 技术栈

| 层级 | 技术选型 | 理由 |
|------|---------|------|
| 桌面壳 | **Electron** | 跨平台成熟度高，文件系统/子进程 API 完善 |
| UI 框架 | **React 18 + TypeScript + Tailwind CSS** | 生态完善，类型安全 |
| 编辑器 | **CodeMirror 6** | 模块化架构，原生支持 Markdown/LaTeX 语言模式 |
| Markdown 渲染 | **markdown-it + KaTeX** | 插件丰富，数学公式渲染快速 |
| LaTeX 渲染 | **混合方案**：WASM 快速预览 + 本地 TeX 发行版完整编译 + pdf.js | 零安装入门，专业用户可选完整编译 |
| 数据库 | **better-sqlite3 + FTS5** | 同步 API，无 IPC 开销，全文搜索能力成熟 |
| 文件监控 | **chokidar** | 处理原子写入、符号链接等边界情况 |
| 状态管理 | **Zustand** | 轻量无样板代码 |
| 构建 | **Vite + electron-builder** | 快速 HMR，成熟打包 |

---

## 应用架构

### 进程模型

```
┌─────────────── MAIN PROCESS (Node.js) ───────────────┐
│  FileManager │ SearchEngine(FTS5) │ LaTeXCompiler    │
│  (CRUD/chokidar)                  │ (spawn pdflatex) │
│         │           │                    │            │
│         └───────────┴────────────────────┘            │
│                     │                                 │
│         ┌───────────┴──────────┐                      │
│         │  better-sqlite3 DB   │                      │
│         │  (notes/tags/FTS5)   │                      │
│         └──────────────────────┘                      │
│                     │                                 │
│         ┌───────────┴──────────┐                      │
│         │  IPC Handlers        │                      │
│         │  (ipcMain.handle)    │                      │
│         └──────────────────────┘                      │
└─────────────────────│────────────────────────────────┘
                      │ contextBridge (preload.ts)
┌─────────────────────│─── RENDERER (React SPA) ────────┐
│         ┌───────────┴──────────┐                      │
│         │  Zustand Store       │                      │
│         │  (notes/search/layout)                      │
│         └──────────────────────┘                      │
│  Sidebar │ Editor(CodeMirror6) │ Preview │ Search     │
└──────────────────────────────────────────────────────┘
```

### 三栏布局

```
┌──────────┬──────────────────┬──────────────┐
│ Sidebar  │  Editor          │  Preview     │
│          │                  │              │
│ FileTree │  CodeMirror 6    │  Markdown    │
│ TagList  │  (Markdown/LaTeX)│  rendered /  │
│ Search   │                  │  PDF.js      │
│          │                  │              │
└──────────┴──────────────────┴──────────────┘
```

---

## 数据库设计

核心表：
- **notes** — 文件路径、格式(.md/.tex)、标题、纯文本内容(供FTS)、哈希、字数、时间戳、frontmatter
- **tags** — 标签名、颜色、父标签(层次标签)
- **note_tags** — 笔记-标签多对多关联
- **notes_fts** — FTS5 虚拟表，索引 title + content + format
- **note_links** — [[wikilink]] 双向链接
- **search_history** — 搜索历史
- **bookmarks** — 收藏

---

## 分阶段实现路径

### Phase 0：项目脚手架（约 1 周）
- Vite + React + TypeScript + Electron 工程搭建
- Tailwind CSS、ESLint、electron-builder 配置
- **交付物**：可启动的 Electron 窗口显示 React 页面

### Phase 1：文件系统 & 基础编辑器（约 2 周）
- FileManager 模块（文件 CRUD + chokidar 监听）
- 侧边栏文件树、工作区选择器
- CodeMirror 6 集成（Markdown 语法高亮）
- 自动保存（2秒防抖）
- **交付物**：浏览文件夹、编辑 .md 文件、自动保存

### Phase 2：数据库层 & 标签系统（约 1 周）
- SQLite 初始化 + 迁移框架
- 工作区扫描建立索引
- FTS5 内容提取（去除 Markdown/LaTeX 标记）
- 标签 CRUD + 侧边栏标签列表
- YAML frontmatter 解析与同步
- **交付物**：笔记索引完成，标签系统可用

### Phase 3：Markdown 预览（约 2 周）
- markdown-it + KaTeX + 插件集成
- 分屏视图（编辑/预览/双栏）
- 滚动同步
- [[wikilink]] 解析 + 反向链接面板
- **交付物**：Markdown 文档美观渲染，公式、链接可用

### Phase 4：全文搜索（约 2 周）
- FTS5 动态查询构建器
- 搜索面板（Cmd+Shift+F）
- 过滤器（格式/标签/日期范围）
- 搜索结果高亮 + 搜索建议
- **交付物**：支持所有过滤条件的全文搜索

### Phase 5：LaTeX 支持（约 3 周）
- CodeMirror LaTeX 语言模式
- TeX 发行版检测（MacTeX 等）
- LaTeXCompiler（spawn pdflatex + 日志解析）
- WASM 快速预览（SwiftLaTeX 降级方案）
- pdf.js PDF 预览
- LaTeX 模板系统
- **交付物**：完整的 .tex 编辑、编译、PDF 预览

### Phase 6：命令面板 & 打磨（约 1 周）
- 命令面板（Cmd+P 模糊搜索命令+笔记）
- 键盘快捷键系统
- 收藏夹、搜索历史
- 深色/浅色主题
- macOS 原生菜单栏
- 窗口状态持久化

### Phase 7：打包分发（约 1 周）
- electron-builder macOS DMG + 签名公证
- electron-updater 自动更新
- Windows/Linux CI 构建矩阵

---

## 安全设计

- **contextBridge + contextIsolation**：渲染进程无 Node.js 权限
- **路径沙箱**：所有文件操作校验在工作区根目录内，防止路径遍历
- **LaTeX 编译沙箱**：`-no-shell-escape` 标志，30s 超时，在临时目录编译
- **HTML 净化**：预览输出经 DOMPurify 处理
- **CSP**：严格的 Content Security Policy

## 性能考量

- 大文件夹（10000+ 笔记）：虚拟滚动（react-virtuoso）
- 大文件（1MB+）：CodeMirror 6 视口渲染，天然支持
- FTS5 查询：10 万笔记下 < 10ms
- PDF 渲染：惰性加载，仅渲染可见页
- 内存：限制撤销历史，关闭笔记时卸载预览

## 项目结构

```
MTeX/
├── src/
│   ├── main/                    # Electron Main Process
│   │   ├── index.ts             # 入口，BrowserWindow，IPC 注册
│   │   ├── preload.ts           # contextBridge 类型化 API
│   │   ├── file-manager.ts      # 文件 CRUD，chokidar 监听
│   │   ├── search-engine.ts     # FTS5 查询构建器
│   │   ├── latex-compiler.ts    # pdflatex 编译，日志解析
│   │   ├── database.ts          # SQLite 连接，迁移
│   │   ├── ipc-handlers.ts      # 所有 ipcMain.handle 注册
│   │   ├── menu.ts              # macOS 原生菜单
│   │   └── utils/
│   │       ├── frontmatter.ts
│   │       ├── content-extractor.ts
│   │       └── tex-detector.ts
│   └── renderer/                # React SPA
│       ├── App.tsx
│       ├── api/bridge.ts        # window.mtexAPI 类型化封装
│       ├── stores/              # Zustand stores
│       ├── components/
│       │   ├── layout/          # AppLayout, Sidebar, EditorPane, PreviewPane
│       │   ├── sidebar/         # FileTree, TagList, SearchBar
│       │   ├── editor/          # CodeMirrorEditor, extensions
│       │   ├── preview/         # MarkdownPreview, LatexPreview, PDFViewer
│       │   ├── search/          # SearchPanel, SearchFilters, SearchResults
│       │   ├── command/         # CommandPalette
│       │   └── common/          # ContextMenu, Modal, Toast
│       ├── hooks/
│       └── styles/
├── resources/                   # 应用图标
└── scripts/
```

## 验证方式

1. Phase 0 完成后：`npm run dev` 启动 Electron 窗口
2. Phase 1 完成后：创建笔记本文件夹，新建/编辑 .md 文件，验证自动保存
3. Phase 2 完成后：检查 SQLite 数据库，验证标签增删改查
4. Phase 3 完成后：编写含公式的 Markdown，验证分屏预览渲染效果
5. Phase 4 完成后：大量笔记中搜索，验证全文搜索准确性和性能
6. Phase 5 完成后：编译 .tex 文件，验证 PDF 输出和错误日志
7. Phase 6-7 完成后：`npm run build` 生成可分发的 DMG
