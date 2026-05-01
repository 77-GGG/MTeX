# MTeX - 跨平台笔记本应用

## 项目概述

基于 Electron 的跨平台桌面笔记本应用，支持 **Markdown** 和 **LaTeX** 双格式编辑，具备 SQLite FTS5 全文搜索与笔记索引。三栏布局：左侧文件树+标签，中间 CodeMirror 源码编辑，右侧 Markdown 实时预览。

- **笔记形态**：文档型（类似 Obsidian/Typora），一篇笔记为一个独立文件
- **格式支持**：.md 和 .tex 两种独立文件格式
- **存储方式**：笔记内容存储为本地文件，元数据和全文索引存储于 SQLite
- **目标平台**：macOS 优先，可扩展 Windows/Linux

## 启动命令

```bash
cd /Users/qiguo/Documents/MTeX
npm run dev          # 启动开发环境（Vite + tsc watch + Electron）
npm run build        # 完整构建
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Electron 34 |
| UI | React 19 + TypeScript 5.7 + Tailwind CSS 4 |
| 编辑器 | CodeMirror 6（Markdown/LaTeX 语法高亮） |
| Markdown 渲染 | markdown-it + KaTeX + highlight.js + DOMPurify |
| LaTeX 渲染 | 待实现（Phase 5） |
| 数据库 | better-sqlite3 + FTS5 |
| 文件监控 | chokidar 4 |
| 构建 | Vite 6 + electron-builder |

## 当前进度

### ✅ Phase 0：项目脚手架
Vite + React + TypeScript + Electron 工程搭建，Tailwind CSS 4 配置，开发环境可启动。

### ✅ Phase 1：文件系统 & CodeMirror 编辑器
- FileManager（CRUD + 原子写入 + chokidar 监听）
- CodeMirror 6（Markdown/LaTeX 高亮、自动补全、暗色主题）
- 自动保存（2 秒防抖）+ 外部文件变更检测
- 侧边栏文件树 + 右键菜单 + 工作区名称

### ✅ Phase 2：数据库 & 搜索 & 标签 & 收藏
- SQLite + WAL + 迁移框架（v1→v2→v3）
- FTS5 全文索引（独立表 + DELETE FROM 触发器）
- 双路搜索：中文 → LIKE 模糊匹配，英文 → FTS5 + bm25 排序
- 内容提取器（Markdown/LaTeX → 纯文本）+ YAML frontmatter 解析
- 标签 CRUD + TagList UI + 标签-文件双向同步
- 收藏系统 + 文件树 ★ 标记 + 筛选
- 增量索引：编辑后自动更新 FTS5
- 工作区打开时全量扫描索引
- 搜索栏实时下拉结果 + 高亮

**Phase 2 修复的关键 Bug：**
- better-sqlite3 需 `electron-rebuild` 适配 Electron Node 版本
- 符号链接循环 → skip + max depth 10
- FTS5 `'delete'` 命令不兼容独立表 → `DELETE FROM notes_fts WHERE rowid = ?`
- `GROUP_CONCAT` 缺 `GROUP BY n.id` 导致结果聚合成 1 行
- SQL 列名 `file_path` vs 前端 `filePath` 不匹配 → SQL 加别名

### ✅ Phase 3：Markdown 预览 & 三栏布局
- markdown-it（GFM 表格、代码高亮 highlight.js、wikilink）
- KaTeX 数学公式（`$...$` 行内 + `$$...$$` 块级）
- DOMPurify HTML 安全净化
- 固定三栏布局：文件栏(260px) | 源码栏 | 渲染栏
- 三栏各自独立滚动（`overflow-hidden` 严格约束高度链）
- [[wikilink]] 点击跳转
- 深色/浅色模式预览样式
- 编辑器工具栏：标签 chips、+tag 按钮、收藏 ★、保存状态

### ✅ Phase 4：全文搜索面板
Cmd+Shift+F 搜索面板、过滤器（格式/标签）、结果高亮 + 编辑器中搜索词临时高亮（4秒消退）

### ✅ Phase 5：LaTeX 编译 & PDF 预览
- LaTeX 编译模块（spawn pdflatex + 日志解析 + 错误提取）
- 手动编译按钮（非实时编译，类似 Overleaf）
- 编译成功 → PDF 嵌入预览（local-pdf:// 自定义协议 + iframe）
- 编译失败 → 红色错误提示
- PDF 自适应高度（flex-1 填满渲染栏）
- 保存 PDF：.md → 隐藏窗口单独渲染 → 打印输出；.tex → 下载已编译 PDF
- TeX 发行版检测（MacTeX / TeX Live）

### ✅ Phase 6：命令面板 & 打磨 (2026-05-01)
- Cmd+P 命令面板（模糊搜索文件 + 命令执行）
- macOS 原生菜单栏（File/Edit/View/Help）
- 窗口状态持久化（记住窗口大小，重启恢复）
- 快捷键：Cmd+N 新建、Cmd+O 打开工作区、Cmd+P 命令面板、Cmd+Shift+F 搜索

### 🔜 Phase 7：打包分发
electron-builder macOS DMG + 签名公证 + 自动更新

## 项目结构

```
MTeX/
├── package.json
├── tsconfig.main.json / tsconfig.preload.json / tsconfig.web.json
├── vite.config.ts
├── PLAN.md / CLAUDE.md
├── scripts/dev.mjs
├── src/
│   ├── main/                         # Electron 主进程
│   │   ├── index.ts                  # 入口：BrowserWindow、IPC、DB 初始化
│   │   ├── preload.ts                # contextBridge API
│   │   ├── file-manager.ts           # 文件 CRUD + chokidar
│   │   ├── database.ts              # SQLite + 迁移（v1→v3）
│   │   ├── search-engine.ts         # FTS5 查询 + 双路搜索
│   │   ├── ipc-handlers.ts          # 所有 IPC 处理器
│   │   └── utils/
│   │       ├── content-extractor.ts # 标记去除
│   │       └── frontmatter.ts       # YAML 解析
│   └── renderer/                    # React SPA
│       ├── index.html / main.tsx / App.tsx
│       ├── api/bridge.ts
│       ├── components/
│       │   ├── WelcomeScreen.tsx
│       │   ├── sidebar/ (Sidebar, FileTree, SearchBar, TagList)
│       │   ├── editor/ (EditorPane)
│       │   ├── preview/ (MarkdownPreview, PreviewPane)
│       │   └── common/ (ErrorBoundary, ContextMenu)
│       ├── hooks/useDebounce.ts
│       └── styles/globals.css
├── dist/                            # 构建输出
└── resources/                       # 应用图标
```

## 架构约定

### 进程隔离
- **Main Process**：文件 I/O、数据库、子进程。`contextIsolation: true`，渲染进程无 Node 权限
- **Preload**：contextBridge 暴露 `window.mtexAPI`
- **Renderer**：React SPA，只能通过 preload API 通信

### IPC 通道
- 请求-响应：`ipcMain.handle` / `ipcRenderer.invoke`（note:*, search:*, tags:*, bookmarks:*, shell:*, workspace:*）
- 事件推送：主进程 `webContents.send`（file:changed, index:updated）

### 文件安全
- 路径校验：`fullPath.startsWith(workspaceRoot)` 防遍历
- 原子写入：write-to-temp-then-rename

### 数据库
- 存储位置：`~/Library/Application Support/mtex/mtex.db`
- WAL 模式，外键约束
- 迁移框架：`_migrations` 表追版本号
- 需要 `electron-rebuild` 编译 better-sqlite3

### 布局
- 三栏固定布局：`flex h-screen overflow-hidden`
- 文件栏：`w-[260px] overflow-y-auto`
- 源码栏：`flex-1 overflow-hidden` + CodeMirror 内部滚动
- 渲染栏：`flex-1 overflow-y-auto`
- 高度链必须完整：`h-screen` → `overflow-hidden` → `h-full`

### 中文搜索
- 中文自动走 LIKE 模糊匹配（`%关键词%`）
- 英文走 FTS5 + bm25 排序
- CJK 检测正则：`/[一-鿿㐀-䶿]/`
