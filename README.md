<p align="center">
  <img src="resources/icons/扁平风.png" alt="MTeX Logo" width="120" />
</p>

<h1 align="center">MTeX</h1>

<p align="center">
  <strong>本地优先、双格式的桌面笔记本</strong>
</p>

<p align="center">
  Markdown 实时预览 · LaTeX 编译与 PDF 预览 · FTS5 全文搜索 · 标签与收藏
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-34-47848f" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61dafb" alt="React" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## 这是什么？

MTeX 是一款**本地优先**的跨平台桌面笔记应用。一篇笔记就是一个 `.md` 或 `.tex` 文件——你始终拥有自己的数据，不依赖任何云服务。

与 Typora / Obsidian 类似，但 MTeX 同时**原生支持 LaTeX**：你可以直接新建 `.tex` 笔记，调用本机 TeX 发行版编译，在右侧面板实时预览生成的 PDF。

## 为什么选择 MTeX？

| | MTeX | Typora | Obsidian | Overleaf |
|---|---|---|---|---|
| Markdown 所见即所得 | ✓ | ✓ | ✓（源码+预览） | — |
| 原生 LaTeX 文件支持 | **.tex 文件直接编辑 + 编译** | 仅公式 | 仅公式 | ✓ |
| 双向链接 / 反向链接 | ✓ | — | ✓ | — |
| 图片粘贴/拖拽插入 | ✓ | ✓ | ✓ | — |
| 本地优先 | ✓ | ✓ | ✓ | 云端 |
| 离线可用 | ✓ | ✓ | ✓ | 付费 |
| FTS5 全文搜索 | ✓ | — | — | — |
| 标签 + 收藏系统 | ✓ | — | 社区插件 | — |
| 模板系统 | ✓ | — | 社区插件 | ✓ |
| 开源免费 | ✓ | 付费 | 免费 | 免费/付费 |

## 功能一览

### 📝 双格式编辑

同时支持 Markdown 和 LaTeX 两种文件格式。CodeMirror 6 提供语法高亮、自动补全和暗色主题，2 秒防抖自动保存，外部文件变更实时检测。

### 🖥️ 三栏布局

左侧文件树 + 标签面板，中间 CodeMirror 源码编辑，右侧实时预览。三栏独立滚动，面板比例可按需调整。

### 📊 Markdown 实时预览

GFM 表格、代码块语法高亮（highlight.js）、KaTeX 行内与块级数学公式、`[[wikilink]]` 笔记间链接跳转，XSS 防护（DOMPurify）。

### 🖼️ 图片粘贴 & 拖拽插入

直接 `Cmd+V` 粘贴剪贴板截图，或把图片文件拖入编辑器——图片自动按内容哈希去重保存到工作区 `assets/` 目录，并在光标处插入 Markdown 引用，右侧预览即时显示（经受限的 `mtex-asset://` 协议安全加载，仅放行工作区内的图片）。

### 🔗 反向链接

在任意笔记底部查看「哪些笔记通过 `[[wikilink]]` 链接到了当前笔记」，一键跳转。链接图谱在后台增量维护，大小写不敏感、自动忽略别名与路径。

### 📄 LaTeX 编译 & PDF 预览

类似 Overleaf 的手动编译模式：编写 `.tex` 源文件，点击 **Compile**，调用本机 XeLaTeX 或 pdflatex 编译。编译成功则在右侧面板嵌入 PDF 预览；失败则红色高亮错误信息并定位到源文件对应行。支持中文 ctex 文档类。

### 🔍 全文搜索

`Cmd+Shift+F` 打开搜索面板。基于 SQLite FTS5 + bm25 相关性排序，中文自动切为模糊匹配。支持按文件格式（`.md` / `.tex`）和标签过滤，搜索结果高亮。

### 🏷️ 标签 & 收藏

为笔记添加标签，标签信息自动同步到 YAML frontmatter。收藏夹一键筛选收藏的笔记，文件树中 ⭐ 标记清晰可见。

### ⚡ 命令面板

`Cmd+P` 呼出命令面板，输入关键词模糊匹配文件名或可用命令，快速跳转。

### 📋 模板系统

7 个内置模板（空白笔记、会议记录、实验报告等），支持用户自定义模板与 `{{date}}` 占位符，新建笔记时一键创建。

### 🌓 暗色模式

编辑器与预览面板均支持深色/浅色主题，随系统自动切换或手动选择。

## 截图

> 即将补充 —— 欢迎提交 PR 添加应用截图。

## 安装

### 下载预编译包

前往 [GitHub Releases](../../releases) 下载最新版本的 DMG（macOS）、NSIS（Windows）或 AppImage（Linux）。

### 从源码构建

```bash
# 环境要求：Node.js ≥ 20，npm ≥ 10

git clone https://github.com/77-GGG/MTeX.git
cd MTeX
npm install
npm run dev          # 启动开发环境
```

**LaTeX 编译功能**（可选）需要本机安装 TeX 发行版：
- macOS：`brew install --cask mactex` 或安装 [MacTeX](https://tug.org/mactex/)
- Windows：安装 [TeX Live](https://tug.org/texlive/) 或 MiKTeX
- Linux：`sudo apt install texlive-xetex texlive-latex-extra`

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 34 |
| 前端 | React 19 + TypeScript + Tailwind CSS 4 |
| 状态管理 | Zustand |
| 编辑器 | CodeMirror 6 |
| Markdown 渲染 | markdown-it + KaTeX + highlight.js + DOMPurify |
| 数据库 | better-sqlite3 + FTS5 |
| 文件监控 | chokidar 4 |
| 构建 | Vite 6 + electron-builder |

## 开发

```bash
npm run dev          # 启动开发环境（Vite + tsc watch + Electron）
npm run build        # 完整编译
npm run dist         # 打包（macOS 跳过签名：CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist）
npm run typecheck    # 类型检查
```

项目遵循 Electron 标准进程隔离模型：Main Process 负责文件 I/O 与数据库，Preload 通过 `contextBridge` 暴露安全 API，Renderer 为纯 React SPA。

详细的架构说明与开发约定见 [CLAUDE.md](CLAUDE.md)。

## License

[MIT](LICENSE)
