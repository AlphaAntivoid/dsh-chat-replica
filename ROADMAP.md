# Roadmap

后续工作清单。自动化任务每次取**第一条未勾选**的条目，完成后勾选并记录版本号与结果。

## 待办

- [x] 1. README 补「编辑消息」与「分叉」截图
  - 用 `dsh-tools/make-screenshots.js` 增加场景（编辑弹窗、分叉后的列表），输出到 `media/screenshots/`
  - 中英 README 各加引用；截图脚本里菜单项索引与按钮文案要同步（菜单 5 项：重命名/置顶/多选/导出/删除）
  - 验收：两张 PNG 入库，中英 README 均能显示
  - 完成 v1.8.1：新增 `edit-message-dark.png`、`fork-dark.png`；菜单 5 项索引已核对，对话框 textarea 内容可正确渲染

- [ ] 2. 字体大小设置
  - 设置面板「通用设置」加三档（小 / 标准 / 大），存 `deepseek-chat-ui.font.v1`
  - 消息正文与输入框由 CSS 变量 `--cd-text-size` 驱动（默认 16px，小 14 / 大 18）
  - 中英文案齐全；渲染测试覆盖「选大号后样式变量生效」
  - 验收：`npm test` 新增断言通过

- [ ] 3. 设置面板显示版本与仓库链接
  - 面板底部显示 `vX.Y.Z · GitHub`，版本号常量与 `package.json` 保持一致，并由元数据测试校验
  - 链接在新标签打开（`target="_blank" rel="noreferrer"`）
  - 验收：元数据测试校验通过

- [ ] 4. 长列表窗口化评估
  - 评估真正虚拟化（窗口化渲染）的收益与风险：保持置顶分组、搜索、多选、键盘可用
  - 若实现，只渲染视口 + 缓冲区；若不实现，把结论（阈值建议、`content-visibility` 实测）写进 `docs/PERF.md`
  - 验收：代码或文档落地，测试全绿

## 约定

- 版本：功能 +0.1.0，修复 +0.0.1；`CHANGELOG.md` 中英各一节
- 提交：提交信息写临时文件后 `git commit -F <file>`（直接 `-m` 含 `/` 或引号会被 PowerShell 拆参数）
- 发布：推送 main 后再推 tag；GitHub Actions 自动构建并创建 Release；用 API 校验资产 SHA256
- Host 侧（`index.js`）改动需要重启 App 才生效，提交说明与回复里要提醒用户
