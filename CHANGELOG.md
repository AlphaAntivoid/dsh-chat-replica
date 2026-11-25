# Changelog

每个版本同时保留中文与 English 两小节；`scripts/release-notes.mjs` 会取出版本对应小节作为 GitHub Release 的正文。
Every version keeps a Chinese and an English section together; `scripts/release-notes.mjs` turns that section into the GitHub Release body.

## 1.3.0

### 中文

- 导入去重：标题、更新时间、消息数与首条消息相同即视为重复，导入结果会显示「跳过 N 个重复」
- 本地存储写满时给一次可见提示（`本地存储已满，最近的改动可能没有保存`），不再静默失败
- 面板级错误边界：渲染异常时只显示兜底页并提供「重试」，不再整页白屏

### English

- Import de-duplication: identical title, update time, message count and first message count as a duplicate, and the result reports "skipped N duplicates"
- A full localStorage now surfaces a visible toast instead of failing silently
- Panel-level error boundary: a render failure shows a fallback with "Retry" instead of blanking the page

## 1.2.0

### 中文

- 多选增强：支持全选 / 取消全选（作用于当前筛选结果）、批量导出选中会话，Esc 直接退出多选
- 键盘可达性：菜单打开即聚焦第一项，方向键 / Home / End 在四项间移动；行上 F2 重命名、Delete 删除
- 对话框把 Tab / Shift+Tab 限制在框内，关闭后焦点回到原来的控件
- 选中数量的变化通过 `aria-live` 播报

### English

- Multi-select gains select-all / clear-all (scoped to the current filter), bulk export of the selected conversations, and Escape to leave
- Keyboard support: opening the menu focuses its first row, Arrow keys / Home / End move between rows, F2 renames and Delete deletes from a focused conversation
- Dialogs trap Tab / Shift+Tab inside themselves and restore focus to the previous control on close
- The selection count is announced through `aria-live`

## 1.1.0

### 中文

- 新增会话搜索：按标题与消息全文过滤，命中为空时提示「没有匹配的对话」，Esc 或清除按钮恢复全部
- 草稿按会话隔离：切换对话不再把半句话带过去，切走面板再回来草稿仍在（`deepseek-chat-ui.drafts.v1`）
- 删除会话或「删除所有对话」时同步清理对应草稿
- README 截图更新，补上搜索入口

### English

- Added conversation search: filters titles and message bodies, shows "No matching conversations" when nothing hits, and Esc or the clear button restores the full list
- Drafts are now stored per conversation: switching conversations no longer carries text over, and a draft survives leaving the panel (`deepseek-chat-ui.drafts.v1`)
- Deleting a conversation (or all conversations) removes its draft too
- Refreshed the README screenshots to show the search field

## 1.0.1

### 中文

- 新增英文 README（`README.en.md`），与中文版互相链接
- 新增 DSH 插件详情页：`docs/DETAIL.md`、`docs/DETAIL.zh.md` 与自绘预览图 `docs/preview.svg`
- 通过 `engines.dsh` 声明兼容的 DSH 版本（`>=0.2.2-rc.3 <0.3.0`），不兼容时安装会被拦下
- 测试进入仓库：`npm test` 覆盖渲染回归、样式类完整性与包元数据
- 新增 GitHub Actions：push / PR 跑检查；打 `v*` tag 自动构建安装包并创建 Release

### English

- Added an English README (`README.en.md`), cross-linked with the Chinese one
- Added a DSH plugin detail page (`docs/DETAIL.md`, `docs/DETAIL.zh.md`) with a hand-drawn `docs/preview.svg`
- Declared the compatible DSH range through `engines.dsh` (`>=0.2.2-rc.3 <0.3.0`), so incompatible installs are refused
- Tests now live in the repo: `npm test` covers render regressions, stylesheet integrity and package metadata
- Added GitHub Actions: checks on push / pull request, automatic bundle build and Release on `v*` tags

## 1.0.0

### 中文

- 首个版本：会话列表菜单（重命名 / 置顶 / 多选 / 二次确认删除）、流式对话、智能搜索、语音输入、朗读、导入导出、主题与语言设置

### English

- First release: conversation list menu (rename / pin / multi-select / confirmed delete), streaming chat, smart search, voice input, read-aloud, import & export, theme and language settings
