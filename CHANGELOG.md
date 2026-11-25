# Changelog

每个版本同时保留中文与 English 两小节；`scripts/release-notes.mjs` 会取出版本对应小节作为 GitHub Release 的正文。
Every version keeps a Chinese and an English section together; `scripts/release-notes.mjs` turns that section into the GitHub Release body.

## 1.8.0

### 中文

- 新增消息编辑：用户消息的操作行可「编辑」并重新生成，保存后截断到该条、丢弃之后的内容；`Ctrl/Cmd+Enter` 保存，`Esc` 取消
- 编辑对话框有焦点陷阱与关闭后焦点还原，空内容不可提交
- 与「分叉」一起构成完整的分支工作流：想保留原答案就分叉，想改问题就编辑重答

### English

- Added message editing: a user message's action row can edit and re-answer; saving truncates to that message and discards what follows, with `Ctrl/Cmd+Enter` to save and `Esc` to cancel
- The edit dialog traps focus, restores it on close, and refuses empty content
- Together with Fork this completes the branching workflow: fork to keep the old answer, edit to ask differently

## 1.7.0

### 中文

- 新增「分叉」：任意一条回答的操作行可把会话复制到该回答为止，生成新会话（标题带「· 分叉」），便于换个方向继续；分叉不继承置顶
- 会话行启用 `content-visibility:auto`，长列表只渲染视口附近的行，滚动更轻
- 消息操作行新增分叉按钮（复制 / 朗读旁），键盘可聚焦

### English

- Added Fork: the action row of any answer copies the conversation up to that answer into a new conversation titled "· fork", so you can continue in another direction; pin state is not inherited
- Conversation rows use `content-visibility:auto`, so long lists only render what is near the viewport
- The message action row gains a fork button next to copy / read-aloud, and it is keyboard focusable

## 1.6.0

### 中文

- 导出文件夹浏览器的快捷目录改由 Host 提供（新路由 `/chat-replica/paths`）：桌面显示 Downloads / Documents / 主目录，Android 才显示 `/sdcard`，不再写死 Android 路径
- 导出文件名追加毫秒，连续导出不会互相覆盖
- 会话搜索支持回车打开第一条命中

### English

- The export-folder browser now takes its shortcuts from the Host (new `/chat-replica/paths` route): Downloads / Documents / Home on desktop, `/sdcard` only on Android, instead of hard-coded Android paths
- Export file names include milliseconds, so back-to-back exports never overwrite each other
- Pressing Enter in the conversation search opens the first match

## 1.5.2

### 中文

- 修复导出文件丢字段：Host 的导出清洗现在保留 `pinnedAt` 与每条消息的 `at`，置顶状态和时间戳在导出 / 导入后不再丢失
- Host 新增端到端测试：把单条会话经真实路由写进临时目录，并校验 `pinnedAt` / `at` 保真

### English

- Fixed lost fields in exported files: the Host sanitizer now keeps `pinnedAt` and each message's `at`, so pin state and timestamps survive export and import
- Added an end-to-end Host test that exports one conversation through the real route into a temporary folder and checks both fields

## 1.5.1

### 中文

- 修复导出在 Windows 上总是失败：Host 现在接受 Windows 绝对路径（`C:\...`），并且只使用真实存在的目录；回退顺序改为「请求目录 → Android `/sdcard/Download`（存在时）→ 用户 Downloads / Download / Documents（自动创建）」
- 「导出位置」默认值改成「默认（系统下载目录）」，不再显示 Android 专用路径
- 新增 Host 侧单测覆盖目录解析；`npm test` 现在跑 4 个套件

### English

- Fixed exports always failing on Windows: the Host now accepts Windows absolute paths (`C:\...`) and only uses directories that exist; fallbacks are the requested folder → Android `/sdcard/Download` (when present) → the user's `Downloads` / `Download` / `Documents` (created on demand)
- The default export folder is now "Default (system Downloads)" instead of an Android-only path
- Added a Host-side test for the directory resolution; `npm test` now runs four suites

## 1.5.0

### 中文

- 删除可撤销：确认后提示条保留 **8 秒** 并提供「撤销」，恢复会话、草稿和当时打开的会话
- 撤销快照只保留最近一次：超时或期间再次删除其他会话，之前的就永久删除
- 撤销按钮可通过键盘访问，提示条使用 `role="status"` 播报

### English

- Deletion is undoable: after confirming, the toast stays for **8 seconds** with an "Undo" action that restores the conversations, their drafts and the one that was open
- Only the latest deletion keeps an undo snapshot; after 8 seconds, or once another deletion happens, it is permanent
- The undo action is keyboard reachable and the toast is announced through `role="status"`

## 1.4.0

### 中文

- 消息显示本地时间（`HH:MM`），与复制 / 朗读按钮一起出现，导入导出也保留时间戳
- 会话菜单新增「导出」：把单条会话写成 JSON 存到「导出位置」
- README 增加架构图（浏览器 / Host 两侧与数据流），并更新截图（菜单包含导出项）

### English

- Messages show their local time (`HH:MM`) next to the copy / read-aloud actions, and timestamps survive import and export
- The conversation menu gains "Export", which writes just that conversation as JSON into the export folder
- Added an architecture diagram (browser and host halves with the data flow) and refreshed the screenshots to include the export row

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
