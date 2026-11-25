# Changelog

每个版本同时保留中文与 English 两小节；`scripts/release-notes.mjs` 会取出版本对应小节作为 GitHub Release 的正文。
Every version keeps a Chinese and an English section together; `scripts/release-notes.mjs` turns that section into the GitHub Release body.

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
