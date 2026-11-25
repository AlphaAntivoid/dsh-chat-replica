# 长列表性能评估

> 评估基线：v1.10.0（文档随 v1.10.1 发布，2026-11-25）
> 结论：**暂不实现真正的窗口化（虚拟滚动）**，继续用 `content-visibility: auto`。
> 建议阈值：桌面端 ≤ 1,500 条保持现状，移动端 ≤ 800 条保持现状；超过后再做窗口化。

## English summary

- The sidebar renders every filtered conversation and relies on `content-visibility: auto`
  to skip layout and paint of off-screen rows.
- Measured in Edge 158 headless: at 3,000 rows, `content-visibility` cuts forced layout
  from ~45 ms to ~11 ms, while DOM creation/parsing (~30 ms) is unchanged.
- A headless React render harness puts selecting one row at ~3.5 / 14 / 53 ms and entering
  multi-select at ~7 / 21 / 64 ms for 200 / 1,000 / 3,000 conversations.
- No windowing for now. Revisit above ~1,500 conversations on desktop or ~800 on mobile,
  then implement fixed-height windowing with sticky headers, full-list selection state and
  focus management.
- `content-visibility` only helps layout/paint; the remaining costs are DOM size and the
  reconciliation of every row on each selection or multi-select change.

## 现状

`client.js` 的会话侧栏（`Sider`）每次渲染都会输出**筛选后的全部会话**：

- 搜索按标题与消息正文过滤（`visibleThreads`），置顶组 + 今天 / 昨天 / 7 天内 / 30 天内分组（`groupThreads`）
- 每行高度固定：桌面 40 px、移动端 44 px（`.cd-item`）；分组标题 18 / 22 px
- 行本身通过 CSS `content-visibility: auto` + `contain-intrinsic-size: auto 40px` 跳过屏幕外的布局与绘制
- 没有窗口化、分页或「加载更多」；选中、进入多选、搜索都会重渲染整个侧栏

会话数据存在 `localStorage`（`deepseek-chat-ui.threads.v1`），包含每条会话的完整消息体；
本地存储配额（约 5 MB）本身会把实际可保存的会话数限制在一个有限范围内，但标题很短的测试数据
可以轻松堆到数千条，因此下面用 200 / 1,000 / 3,000 三档测量。

## 测量方法

环境：

| 项 | 值 |
| --- | --- |
| OS | Windows 11 家庭版 10.0.26300 |
| CPU | Intel Core i7-14700HX（20 核 / 28 线程） |
| 内存 | 32 GB |
| Edge | 158.0.4370.33，`--headless=new`，窗口 1100×720 |
| JS 运行时 | DSH 自带 Electron 的 Node 模式，Node v24.21.0 |

### 1. 浏览器插入 + 强制布局

用仓库的 headless 渲染脚本（`test/render.test.cjs` 里的 React 子集）生成 200 / 1,000 / 3,000 条会话、
每 50 条置顶一条的真实侧栏 HTML（`long-<n>.html`）。测量页把这部分 DOM 放进一个惰性的
`<template>`，运行时把内容 `innerHTML` 到 `#app` 五次：

```js
app.innerHTML = '';
app.getBoundingClientRect();          // 清空后的基线布局
const t0 = performance.now();
app.innerHTML = html;                 // DOM 解析 + 节点创建
const t1 = performance.now();
app.getBoundingClientRect();          // 强制布局
const t2 = performance.now();
// 取五次的中位数：parse = t1 - t0，layout = t2 - t1
```

- 「关闭」变体只是从样式表里删掉 `content-visibility:auto;contain-intrinsic-size:auto 40px`，
  其余 DOM/CSS 完全相同；脚本同时读取 `getComputedStyle(item).contentVisibility`，
  确认开启组为 `auto`、关闭组为 `visible`
- 每个变体跑 3 个独立的 Edge 进程，每个进程内插入 5 次；先取进程内 5 次的中位数，
  再取 3 个进程的中位数
- 这个测量**不含绘制与合成**，只覆盖 DOM 创建和主线程布局

### 2. 无头 React 重渲染

用同一个 headless React 子集（fake DOM，无布局/绘制）加载真实 `client.js`，以同样的
200 / 1,000 / 3,000 条会话为种子，记录：

- 初次渲染（`renderPanel`）
- 打开一条会话（选中行，侧栏全量重渲染）
- 搜索「会话 01」（重算筛选 + 渲染 100 条命中）
- 从行菜单进入多选（全量重渲染）
- 在多选里切换一行

每个规模先做一次热身，再取 4 次的中位数。

## 结果

### 浏览器：插入 + 布局（中位数，毫秒）

| 会话数 | DOM 节点 | CV 开：解析 / 布局 | CV 关：解析 / 布局 |
| ---: | ---: | ---: | ---: |
| 200 | 1,493 | 1.8 / 0.9 | 1.9 / 3.2 |
| 1,000 | 7,093 | 8.6 / 2.8 | 9.5 / 14.8 |
| 3,000 | 21,093 | 29.6 / 10.7 | 26.9 / 45.4 |

解读：

- `content-visibility` 把强制布局从 3.2 / 14.8 / 45.4 ms 降到 0.9 / 2.8 / 10.7 ms，
  在 1,000 条以上约为 **1/4 到 1/5**
- 它**不减少 DOM 节点，也不减少解析/创建时间**；3,000 条时仍要花约 30 ms 创建 21,000 个节点
- 200 条时开关只差约 2 ms，用户无法感知；这也是日常规模下的典型值
- CV 关的解析时间在 3,000 条时略低是测量噪声；解析与这条 CSS 声明无关

### 无头 React：交互重渲染（中位数，毫秒）

| 会话数 | 初次渲染 | 选中一条 | 搜索（100 命中） | 进入多选 | 切换勾选 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 200 | 1.5 | 3.5 | 3.6 | 7.4 | 0.6 |
| 1,000 | 4.7 | 14.3 | 8.7 | 21.3 | 4.2 |
| 3,000 | 16.0 | 53.4 | 18.1 | 64.3 | 6.3 |

解读：

- 选中一条会话会把全部行重新 reconcile；这是窗口化能解决的主要部分
- 3,000 条时选中（53 ms）和进入多选（64 ms）都超过两帧，低端移动设备还会更慢
- 搜索只渲染 100 条命中，18 ms 里还包含遍历全部标题/消息的过滤成本；窗口化不会消除这部分，
  需要单独优化（索引或增量过滤）
- 这些数字来自 fake DOM，不含样式计算、布局与绘制，真实浏览器会更慢；用于比较数量级和趋势，不当作绝对预算

## 为什么不现在窗口化

1. **真实规模不够大。** 侧栏是个人会话列表，常见是几十到几百条；本地存储配额也会先到上限。
2. **当前瓶颈不是布局。** CV 已把 3,000 条的布局压到约 11 ms；剩下的 DOM 创建与 reconcile
   只在数千条时明显。
3. **窗口化会动到所有现有交互。** 置顶分组与 sticky 分组标题、键盘操作（F2 / Delete / Enter）、
   多选、搜索、活动会话滚动定位都默认「所有行都在 DOM 里」；改错的代价高于收益。
4. **测试成本高。** 现有 fake DOM 没有布局信息，窗口范围计算需要抽成纯函数单独测，
   还要补真实浏览器的滚动/焦点验证。

## 如果将来要做：收益与风险

收益：

- DOM 节点从数万降到窗口大小（视口 + 8~10 行缓冲，约 30~60 行）
- 选中、多选、搜索的 reconcile 成本与总条数解耦
- 长时间使用后的内存与布局抖动更可控

风险 / 必须一起处理：

- **分组标题**：sticky header 需要参与偏移计算；窗口跨越分组时不能丢标题。可把分组扁平化成
  `header` / `item` 两种行，按前缀高度定位。
- **固定行高**：桌面 40 px、移动端 44 px 目前是固定值，窗口化可以依赖它；若以后允许换行标题，
  需要 ResizeObserver 或测量缓存。
- **焦点与键盘**：只有挂载的行能聚焦。F2 / Delete / Enter 的作用对象、菜单触发器、
  关闭菜单后的焦点还原都要定义「行滚出窗口」时的行为；建议保留焦点索引并在重新进入窗口时还原。
- **多选**：选择状态必须独立于渲染窗口；全选/批量操作继续基于 `visibleThreads`，而不是 DOM。
- **搜索**：筛选后把滚动位置重置到顶部；过滤本身仍是全量扫描，必要时另做索引。
- **活动会话**：打开会话或分叉后，如果目标行不在窗口内，需要按索引计算偏移并滚动过去。
- **可访问性**：给窗口内的行补 `aria-setsize` / `aria-posinset`，保持 `role="button"` 的键盘语义。
- **菜单定位**：菜单锚定在触发按钮的 `getBoundingClientRect()` 上，行卸载时菜单必须关闭
  （当前滚动已会关闭菜单）；窗口化后要确保这一点不变。

## 阈值建议

按本机数据线性外推，并给低端移动设备留 2~4 倍余量：

| 场景 | 建议 |
| --- | --- |
| ≤ 500 条 | 保持现状，无需额外处理 |
| 500 ~ 1,500 条（桌面） | 保持现状；若用户反馈卡顿，先做行组件 memo 化或增量过滤 |
| > 1,500 条（桌面） / > 800 条（移动端） | 值得实现窗口化 |
| 任意规模但单次交互 > 100 ms | 视为 bug，按上面的窗口化方案处理 |

窗口化实现时沿用本文的两套基准：浏览器插入/布局看 DOM 与布局成本，无头 React 看 reconcile；
验收标准建议为 3,000 条时选中/多选单次交互 < 16 ms（fake DOM 口径），并补真实移动端滚动验证。

## 复现

仓库内没有内置基准脚本（生成器依赖维护者在 `dsh-tools/` 下的渲染/截图工具，不在发布包中）。
复现核心步骤：

1. 用 `test/render.test.cjs` 的 React 子集把 200 / 1,000 / 3,000 条会话渲染成静态 HTML
   （每 50 条置顶一条，`updatedAt` 分布在 30 天内）
2. 页面与插件的 `<style>` 都放进 `<head>`，把 `<div id="app">…</div>` 的内容移进 `<template>`
3. 用上面的 `innerHTML` + `getBoundingClientRect()` 片段测量 5 次，取中位数
4. 删除 `.cd-item` 规则里的 `content-visibility:auto;contain-intrinsic-size:auto 40px` 作为对照
5. Edge 用 `--headless=new --window-size=1100,720 --dump-dom` 运行；测量结果写入
   `<pre id="bench-result">` 供解析

原始数据（三档规模 × 开关 × 3 进程）保留在维护者的
`dsh-tools/preview/long-list-results.json`，本文件只摘录中位数。
