# dsh-chat-replica

[English](README.en.md) | **简体中文**

把 DeepSeek 网页版 chat-demo 的对话界面搬进 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的插件：会话侧栏、消息气泡、输入框、上传与语音、朗读，颜色全部引用 DSH 主题令牌，自动跟随浅色 / 深色。

> **非官方项目。** 与 DeepSeek、DeepSeek Harness 官方没有任何关联，也不代表其立场。
> 界面布局与文案参考 DeepSeek chat-demo 的公开页面，仅作学习与自用；相关商标与素材归其权利人所有。
> 需要模型能力时调用的是**你自己 DSH 里配置的**模型与密钥，本项目不附带任何密钥。

## 预览

会话列表的「⋯」菜单（深色主题）：

![会话列表菜单](media/screenshots/session-menu-dark.png)

删除的二次确认（深色主题）：

![删除二次确认](media/screenshots/delete-confirm-dark.png)

编辑用户消息并重新生成（深色主题）：

![编辑消息](media/screenshots/edit-message-dark.png)

分叉出的新会话（深色主题）：

![分叉](media/screenshots/fork-dark.png)

会话内查找：`Ctrl/Cmd+F` 输入关键词，命中处高亮并可上下跳转，当前命中用实色标记。

![会话内查找](media/screenshots/find-dark.png)

一键到底：消息滚离底部后，输入框上方右侧浮出圆形按钮；点击按 280ms 线性滚回底部，滚回后线性淡出。

![一键到底](media/screenshots/jump-dark.png)

用法用量与 DSH 一致：每条回答下方显示本轮 `↑ 计费输入 · ↓ 输出`（悬停看缓存命中与推理 token），
输入框右侧的圆环显示上下文占用百分比（悬停看 `约已用 / 窗口`）。点用量行或圆环可展开明细。

![用量与上下文](media/screenshots/usage-dark.png)

上下文面板按来源分段：系统提示 / 对话内容 / 工具调用（本插件没有工具，固定 0），由 Host 的
`{type:'context'}` 帧给出估算。

![上下文分段](media/screenshots/usage-context-dark.png)

模型选择：输入框下方显示当前模型，点开按 provider 分组切换，也可以切回「跟随默认」。

![模型选择](media/screenshots/model-dark.png)

设置页：主题、字号、语言，页脚显示版本、仓库链接与「检查更新」。

![设置](media/screenshots/settings-dark.png)

浅色主题：

![浅色主题](media/screenshots/light.png)

## 功能

- 会话侧栏：按今天 / 昨天 / 7 天内 / 30 天内分组，本地持久化；右上角胶囊 `☰` 打开抽屉、`＋` 新建对话
- 会话搜索：按标题与消息全文过滤，回车直接打开第一条命中；Esc 或输入框里的清除按钮恢复全部
- 草稿按会话隔离：在 A 里打半句去 B 不会串，切走面板再回来也还在
- 键盘可用：菜单方向键 / Home / End 导航，行上 F2 重命名、Delete 删除，对话框内 Tab 循环且关闭后焦点还原
- 每条消息带本地时间（`HH:MM`），悬停或触屏时与操作按钮一起显示
- 任意一条回答可「分叉」：把会话复制到该回答为止生成新会话（标题带「· 分叉」），方便换个方向继续；分叉不继承置顶
- 用户消息可「编辑」并重新生成：保存后截断到该条、丢弃之后的内容（Ctrl/Cmd+Enter 保存，Esc 取消）
- 单条会话可导出为 **Markdown** 阅读稿；JSON 仍用于备份与再导入
- **导出也可选 DeepSeek 官方格式**：生成与 App 导出同结构的 ZIP（`manifest.json` / `user.json` / `chat_session_index.json` / `chat_sessions/<id>.json` + `_files/` 图片），本插件的导入能原样读回
- **图片**：回形针可上传图片（自动缩放到最长边 1600px 后存进本地 IndexedDB），气泡里显示缩略图，点开是大图灯箱（Esc 关闭）；从 DeepSeek 导出 ZIP 导入的图片附件同样会显示
- **附件限制与 App 对齐**：每条对话最多 50 个附件；图片 ≤ 64 MB，文本类文件 ≤ 32 MB。正文大的文件存进 IndexedDB（不进 localStorage），发给模型时每份附件最多 200 KiB，超出会标注「已截断」
- **一键到底**：消息滚离底部后，输入框上方浮出圆形按钮，点击按 280ms 线性滚回底部；按钮本身用 `0.28s linear` 淡入淡出
- 右上角是常驻操作胶囊（查找 / 朗读 / 新对话）；侧栏开关与查找按钮的增减都走 `0.28s linear` 横向动画，开新对话时查找按钮会平滑收起
- 侧边栏本身也是滑入 / 滑出的：宽度在 0 与 261px 之间以 0.28s linear 过渡，和胶囊的收缩同步
- 会话内查找：`Ctrl/Cmd+F`，命中词高亮、当前命中实色，回车 / Shift+回车上下跳转，Esc 关闭
- 模型选择：输入框下方显示当前模型，按 provider 分组切换，可切回「跟随默认」；选择存本地并随请求发送，Host 校验失败会回退默认
- 设置页脚可「检查更新」：点一下才联网查询 GitHub 最新 Release，显示已是最新 / 新版本（再点打开 Release 页）/ 检查失败
- 用量展示与 DSH 对齐：每条回答下方是本轮 `↑ 计费输入 · ↓ 输出`，输入框右侧圆环是上下文占用；悬停可看缓存命中与推理 token
- 点用量行可展开本轮明细（未缓存输入 / 缓存读取 / 缓存写入 / 输出（含推理）/ 缓存命中 / 总计），点圆环可展开上下文面板（百分比、进度条、`~已用 / 窗口`、剩余量、按来源分段）
- 导出带上用量：JSON 保留每轮 `usage`（导入也保留），Markdown 在每条回答后追加一行 `_用量：↑ … · ↓ … · 缓存命中 …%_`
- 消息气泡、欢迎语、输入框，Markdown（标题 / 列表 / 行内代码 / 代码块）与「已思考」折叠块
- 输入框右侧：📎 上传文本文件、🎤 语音输入、发送 / 停止
- 「深度思考」映射到模型的 reasoningEffort（开 = max，关 = off，档位取自模型声明）
- 「智能搜索」先 `ctx.web.search()` 检索，再把前两条正文塞进系统提示，答案带来源链接
- 朗读：官方 TTS 代理，音色 海星（女声）stella / 暗潮（男声）tide；每条回答下方有朗读 / 停止
- 设置面板（两个分类，可左右滑动切换）：
  - 通用设置：主题（浅色 / 深色 / 跟随系统）、字体大小（小 / 标准 / 大，14 / 16 / 18 px，只影响消息正文与输入框）、语言（简体中文 / English，同时切换 DSH 界面语言）、朗读音色与自动朗读
  - 数据管理：导入历史对话（本插件 JSON 或 DeepSeek 官方导出 ZIP）/ 导出历史对话 / 导出位置 / 删除所有对话
  - 面板底部显示版本与 GitHub 仓库链接（在新标签打开）
- 会话列表右上角的「⋯」操作菜单：重命名、置顶、多选（批量置顶 / 删除）、二次确认删除

### 会话列表菜单

每条对话最右侧的「⋯」打开操作菜单：

| 菜单项 | 行为 |
| --- | --- |
| 重命名 | 弹窗改标题：回车保存、Esc 取消；标题写回 localStorage，导出 / 导入也会保留 |
| 置顶 | 单独成组排在所有日期分组之前（按置顶时间倒序）；已置顶的行显示「取消置顶」 |
| 多选 | 进入多选：每行变成复选框，点行切换选择；工具条可全选 / 取消全选（按当前筛选结果）、批量置顶、批量导出、批量删除，Esc 退出 |
| 导出 JSON | 把这一条会话写成 JSON（备份，可再导入），结果显示为提示条 |
| 导出 Markdown | 把这一条会话写成 `.md` 阅读稿：标题、时间、用户 / 助手分段，存到「导出位置」 |
| 删除 | 二次确认；确认后立即移除，并在**8 秒内**提供「撤销」，超时即永久删除 |

删除确认的文案与样式固定：

1. 标题：`删除后，该对话将不可恢复`（多选时为「删除后，选中的 N 个对话将不可恢复」）
2. 标题下小字：`8 秒内可在提示条点「撤销」；超过 8 秒就会永久删除。`
3. 红色气泡 + 白字：`删除该对话`
4. 灰白色 + 黑字：`取消`，默认聚焦，所以回车等于取消

确认后提示条会保留 **8 秒**，带一个「撤销」：撤销会恢复被删的会话、它们的草稿，以及当时正打开的那条。
超过 8 秒，或期间又删除了别的会话（撤销快照只保留最近一次），就真的不可恢复了。

置顶状态存在线程对象的 `pinnedAt` 字段里（与 `deepseek-chat-ui.threads.v1` 同一个存储），
因此刷新、重开 App 后仍然有效；旧数据没有该字段就是未置顶。

删除 / 置顶 / 改名为结构性改动，会**立刻**写入 localStorage（流式回答仍走 400 ms 防抖），
并且面板卸载时再补写一次快照。所以删掉对话后马上切到别的面板、再回来也不会“复活”；
对话删空后保存的是空数组，重新进入不会退回演示用的种子对话。

## 导入格式

设置 → 数据管理 → 导入历史对话 接受两种文件：

- **本插件导出的 JSON**：`{ "threads": [ ... ] }` 或同结构的裸数组
- **DeepSeek 官方 App 导出的 ZIP**（`deepseek_data-YYYY-MM-DD.zip`）：页面内置无依赖 ZIP 读取（stored / deflate，ZIP64 会明确报错），只解压 `chat_sessions/*.json`，不碰图片附件。映射规则：
  - `REQUEST` / `RESPONSE` / `TEMPLATE_RESPONSE` 片段 → 消息正文
  - `THINK` 片段 → 回答下方可折叠的「已思考」块
  - `FILE` 片段 → 附件名标签（本插件不渲染图片，只保留文件名）
  - `pinned`、`inserted_at` / `updated_at` → 置顶与时间；工具调用、联网搜索片段会跳过
  - 顺序按 `parent_id` 链还原到 `current_message_id`：官方导出里回答的时间戳比提问早几毫秒，按时间排序会把每一对问答颠倒，所以不能用时间排；编辑 / 重新生成留下的废弃分支也不会导入

同一份文件导入两次会被指纹去重；解析失败时状态栏会说明是「无法识别 ZIP」「不支持的压缩方式」还是「ZIP 里没有会话文件」。导入全程在本地完成，不经过网络。

## 导出格式

设置 → 数据管理 里有两种导出：

- **导出历史对话**：默认 JSON（`{ "threads": [ ... ] }`），`格式` 选 Markdown 时写 `.md` 阅读稿
- **导出 DeepSeek 格式**：生成 `deepseek_data-YYYY-MM-DD.zip`，目录结构与官方 App 导出一致：

```
manifest.json              { "export_format_version": 3 }
user.json                  账号信息占位（本插件不保存账号）
chat_session_index.json    [{ id, title, pinned, message_count, inserted_at, updated_at }]
chat_sessions/<uuid>.json  { id, title, pinned, current_message_id, inserted_at, updated_at, messages }
chat_sessions/<uuid>_files/ 附件与图片
```

- 消息按 `parent_id` 串成单链，`current_message_id` 指向最后一条；`REQUEST` / `RESPONSE` / `THINK` / `FILE` 片段与官方一致，`status` 写 `FINISHED`
- 图片从本地图片库取出写进 `_files/`，文件名没有扩展名时按 MIME 补 `.png/.webp/...`
- ZIP 在浏览器里组装（有 `CompressionStream` 时用 deflate，否则 stored），再交给 Host 写进「导出位置」
- 这份 ZIP 可以被本插件的导入原样读回；实测把真实的 30 个会话（1056 条消息、154 张图）导出再导入，逐会话对比 0 差异

## 环境要求

- 一个带 Web UI 与插件系统的 DSH 安装（Desktop 版，或 `dsh` 的 web profile）
- **DSH ≥ 0.2.1-rc.2**（`engines.dsh` 声明为 `>=0.2.1-rc.2 <0.3.0`）。0.2.1-rc.2 上已核对 `llm.listProviders` /
  `llm.listModels` / `llm.resolveModelInfo`、`agentDefaultModel.currentSelection` 与前缀路由注册都在；
  后续版本新增的接口若缺失，对应功能会静默降级（例如拿不到模型目录时选择器只剩「跟随默认」）
- 模型、语音识别、朗读分别复用 DSH 中已有的 `llm` / `speechToText` / `DEEPSEEK_API_KEY`，本插件不单独保存凭据

## 安装

最快的方式：从 [Releases](https://github.com/AlphaAntivoid/dsh-chat-replica/releases/latest) 下载最新的
`dsh-chat-replica-<version>.tar.gz`，然后打开 DSH → **插件 → 安装 → 选择该 tar.gz**，刷新页面，
侧栏会出现面板图标「对话模式」，点开即占满中间面板。

也可以自己从源码打包（本仓库就是插件包本体，`package.json` 在根目录；Plugin Manager 接受
「根目录包着一层文件夹」的 tarball）：

```sh
git clone https://github.com/AlphaAntivoid/dsh-chat-replica.git
cd ..
tar -czf dsh-chat-replica.tar.gz dsh-chat-replica
```

再在 DSH 里安装这个 `dsh-chat-replica.tar.gz`。

### 手动安装

把仓库目录放到当前 profile 的 `node_modules` 下，并在该 profile 的 `cordis.patch.yml` 末尾追加一行 insert：

```yaml
- insert:
    - id: deepseek-chat-ui
      name: '@local/deepseek-chat-ui'
```

重启 DSH 后生效。卸载时删掉这段 insert 与 `node_modules/@local/deepseek-chat-ui` 目录即可。

> 包名沿用 `@local/deepseek-chat-ui`（本地作用域，不发布到 npm）。它同时是插件在 DSH 里的模块 id，
> 改名会连带改 `cordis.patch.yml`、`locale/*.json` 与 profile 里已安装的记录。

## 开发

- 插件分两半：`index.js` 跑在 Host（Node），`client.js` 跑在浏览器；后者由 DSH 的 client 模块系统直接加载，
  没有构建步骤。
- 开着 client-hmr 的 profile 会在 `client.js` 落盘后自动热加载；没有生效就重启 DSH。
- 主题颜色只使用 `--dsw-alias-*` / `--dsw-specific-*` 令牌，不要在 CSS 里写死颜色（`#f0f0f0` 这类
  只用于「删除确认」里刻意要求灰白底黑字的按钮）。
- 本地检查：`npm test` 跑无头渲染回归、样式类完整性与包元数据；`npm run bundle` 产出
  `dist/dsh-chat-replica-<version>.tar.gz`。
- 长列表为什么不做虚拟滚动、实测数据与阈值建议见 [docs/PERF.md](docs/PERF.md)。
- 发版：更新 `CHANGELOG.md` 与 `package.json` 的 `version`，打 tag `v<version>` 并推送；GitHub Actions
  会自动跑测试、打包并创建 Release。

## 结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半边：`/chat-replica/chat`（NDJSON 模型流）、`/chat-replica/models`（可用 provider / model 目录）、`/chat-replica/update`（查询最新 Release）、`/chat-replica/transcribe`（16k WAV 转文字）、`/chat-replica/tts`（朗读 PCM 代理）、`/chat-replica/system-theme`、`/chat-replica/paths`（导出快捷目录）、`/chat-replica/export`（写 JSON / Markdown 到指定目录） |
| `client.js` | 浏览器半边：`main` 页面 + `sidebar.panellist` 图标，内含 CSS、中英文字典、Markdown、录音与上传 |
| `cordis.patch.yml` | bundle 补丁（安装时由 Plugin Manager 读取） |
| `locale/zh.json`、`locale/en.json` | Plugin Manager 里显示的名称与描述 |
| `icon.svg` | 插件图标 |

## 架构

![架构图](media/architecture.svg)

- 浏览器半边（`client.js`）负责全部渲染：会话列表、菜单、搜索、对话框
- 会话、草稿、偏好都存在浏览器 `localStorage`，默认不上传
- Host 半边（`index.js`）提供 `/chat-replica/*` 路由，内部只调用 DSH 已装配的服务
  （`llm.stream` / `web.search` / `speechToText` / `agentDefaultModel` / `uiWorkspace`）
- 朗读请求由 Host 用 profile 里的密钥代发到 `api.deepseek.com`

## 数据流

1. 页面 `POST /chat-replica/chat`，body 是 `{messages:[{role,text}], thinking, search, query, model?}`；
   `model` 是页面上选的 `{provider, model}`，缺省表示跟随配置。
2. Host 先用 `resolveModelInfo()` 校验页面给的模型：认识就用，否则回退
   `agentDefaultModel.currentSelection()`，并在流开头回一帧 `{type:'model'}` 说明实际选择。
   开关 search 时先 `web.search()`（并把 `search:start/done` 帧回传页面），再抓前两条正文；
   然后取 provider/model，按开关选 reasoningEffort，调用
   `ctx.llm.stream()`，把 `text-delta` / `reasoning-delta` 逐行写成 NDJSON。
3. 页面把增量折进消息气泡，`reasoning` 显示为可折叠的「已思考」块；停止生成会 abort 请求，
   Host 端随之取消模型流。
4. 语音：页面用 Web Audio 录 16 kHz 单声道 PCM，编成 WAV 上传；Host 走 `speechToText` provider。
5. 会话保存在 `localStorage`（`deepseek-chat-ui.threads.v1`），开关状态在 `deepseek-chat-ui.prefs.v1`，
   字体大小在 `deepseek-chat-ui.font.v1`，朗读设置（音色 + 自动朗读）在 `deepseek-chat-ui.tts.v1`。
6. 朗读与网页 demo 一致：`POST https://api.deepseek.com/v1/tools/tts`，
   `{text, voice_id: stella|tide, format: pcm, filter_markdown: true}`，返回 24 kHz 单声道 16 位 PCM；
   Host 用 profile 里的 `DEEPSEEK_API_KEY` 代发，页面按 `AudioContext(24000)` 排程播放。
7. 导出走 `POST /chat-replica/export`（body 里带 `dir` 与可选的 `format`）：Host 把会话写成
   `<dir>/deepseek-chat-<本地时间>.json`（`format: 'markdown'` 时写 `.md` 阅读稿）。`dir` 留空表示交给 Host 选：优先用页面给的目录（必须已存在），
   其次是 Android 的 `/sdcard/Download`（仅在该路径存在时），再退到用户的 `Downloads` / `Download` /
   `Documents`（不存在会自动创建）；响应里的 `dir` 就是实际写入位置。
   JSON 响应统一带 `cache-control: no-store, no-transform`：carrier 的 gzip 重写会提前发送响应头，
   导致浏览器报「Failed to fetch」。
   页面里的「导出位置」用 `uiWorkspace.listDirectory()` 做内置文件浏览，选择结果存在
   `deepseek-chat-ui.export-dir.v1`。导入读同一格式（也接受裸数组）。
8. 用量：`llm.stream` 的 `usage` 分片原样转成 `{type:'usage', usage}` 帧，页面把它存进对应回答；
   `{type:'model'}` 帧带上 `resolveModelInfo().context.contextWindow`（`/models` 的 `current` 也会带），
   页面用「上一次计费输入 + 本轮输出 ÷ 窗口」画上下文圆环。
   `{type:'context'}` 帧给出按来源的估算（系统提示 / 对话内容 / 工具调用）：
   CJK 1 字 ≈ 1 token、ASCII 4 字符 ≈ 1 token，仅用于分段条，不参与计费。
9. 导出：JSON 保留每条消息的 `usage`；Markdown 在回答后追加一行 `_用量：…_`。导入时只接受数值字段。

## 隐私

- 对话内容默认只存在浏览器 `localStorage`，不会上传到本项目持有的任何服务。
- 模型请求、语音识别、朗读都由**你自己的 DSH Host** 发起；朗读走 `api.deepseek.com` 的 TTS 接口，
  用的是你 profile 里的密钥。
- 导出文件写到你自己选择的目录；Host 另把每次导出结果追加到 `~/.dsh/chat-replica-export.log`。

## 已知边界

- 上传只收文本类文件（≤512 KB、≤5 个），PDF / Office / 图片不解析。
- 语音依赖 WebView 的麦克风授权与 `speechToText` provider；两者缺失时会提示。
- 语音识别模型（SenseVoice，163 MB）未下载时麦克风会提示；下载后可离线识别。
- 语言切换写的是 DSH 自己的 locale 偏好，所以整个界面（含侧栏）会一起换语言。
- 导入会跳过重复条目：标题、更新时间、消息数与首条消息相同视为同一份，状态栏会显示跳过数量
- 本地存储写满时不会静默丢数据，会弹出「本地存储已满」提示
- 面板渲染异常时只显示这一块的兜底页（带重试），不会整页白屏
- 「删除」只有 8 秒撤销窗口（提示条上的「撤销」）；超时，或期间再次删除其他会话会覆盖撤销快照，之后不可恢复
- Markdown 导出目前只支持单条会话；批量导出与导入仍使用 JSON
- 图片只存在浏览器的 IndexedDB（数据库 `deepseek-chat-ui-images`），不会进入 JSON / Markdown 导出，也不会发给模型；请求里只带一行「【图片】文件名」提示
- 附件限制对齐官方 App（50 个/条、图片 64 MB、文本 32 MB），但**格式**仍只支持文本类与图片：App 支持的 PDF / Word / Excel / PPT（100 MB）不在解析范围内
- 上下文占用是**近似值**：上一次计费输入 + 本轮输出，除以 route 声明的窗口；DSH 那边有 token-meter 的压力投影，这里没有等价的实时采样。分段条同理，是按字符数的估算（CJK 1 字 ≈ 1 token、ASCII 4 字符 ≈ 1 token），不是 provider 的精确分词

## 复刻来源

从 chat-demo 的 `main.css` 提取了布局尺寸（侧栏 261px、输入框 24px 圆角、气泡 22px 圆角、列宽
712 / 840px 等）与全部 `--dsw-alias-*` / `--dsw-specific-*` 令牌用法；文案取自其 i18n 字典。

## 许可

[MIT](./LICENSE) © 2026 AlphaAntivoid
