window.__ModuleLoader__.load({
  id: '@local/deepseek-chat-ui',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const useState = React.useState;
    const useEffect = React.useEffect;
    const useMemo = React.useMemo;
    const useRef = React.useRef;
    const useCallback = React.useCallback;

    const PANEL_ID = 'deepseek-chat-ui';
    const NS = 'deepseek-chat-ui';
    const API = '/chat-replica';
    /** 设置面板底部展示的版本；必须与 package.json 的 version 一致（元数据测试校验）。 */
    const PLUGIN_VERSION = '1.25.1';
    const REPO_URL = 'https://github.com/AlphaAntivoid/dsh-chat-replica';
    const STORE_THREADS = 'deepseek-chat-ui.threads.v1';
    const STORE_ACTIVE = 'deepseek-chat-ui.active.v1';
    const STORE_DRAFTS = 'deepseek-chat-ui.drafts.v1';
    /** 新建对话视图在草稿表里的键；真实会话用各自的 id。 */
    const DRAFT_NEW = '__new__';
    const STORE_PREFS = 'deepseek-chat-ui.prefs.v1';
    const STORE_EXPORT_DIR = 'deepseek-chat-ui.export-dir.v1';
    const STORE_THEME_PREF = 'deepseek-chat-ui.theme-pref.v1';
    const STORE_TTS = 'deepseek-chat-ui.tts.v1';
    const STORE_FONT = 'deepseek-chat-ui.font.v1';
    const STORE_MODEL = 'deepseek-chat-ui.model.v1';
    const STORE_CONTEXT_WINDOW = 'deepseek-chat-ui.context-window.v1';

    /** 上一次已知的上下文窗口；只在拿不到实时值时兜底展示。 */
    function loadContextWindow() {
      try {
        const raw = window.localStorage.getItem(STORE_CONTEXT_WINDOW);
        const value = raw === null ? NaN : Number(raw);
        return Number.isFinite(value) && value > 0 ? value : null;
      } catch (error) {
        return null;
      }
    }

    function saveContextWindow(value) {
      try {
        if (typeof value === 'number' && value > 0) {
          window.localStorage.setItem(STORE_CONTEXT_WINDOW, String(value));
        }
      } catch (error) {
        /* ignore quota errors */
      }
    }

    /** 与 DSH 一致的紧凑计数：999、1.2K、12K、1.2M。 */
    function formatTokenCount(value) {
      const count = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
      if (count < 1000) return String(count);
      if (count < 1000000) {
        const scaled = count / 1000;
        return (scaled >= 100 ? String(Math.round(scaled)) : String(Math.round(scaled * 10) / 10)) + 'K';
      }
      const scaled = count / 1000000;
      return (scaled >= 100 ? String(Math.round(scaled)) : String(Math.round(scaled * 10) / 10)) + 'M';
    }

    /** 计费输入 = 未缓存输入 + 缓存读取 + 缓存写入（三者互不重叠）。 */
    function billedInputTokens(usage) {
      if (!usage || typeof usage !== 'object') return 0;
      const input = Number(usage.inputTokens) || 0;
      const read = Number(usage.cacheReadTokens) || 0;
      const write = Number(usage.cacheWriteTokens) || 0;
      return input + read + write;
    }

    /** 一轮的上行/下行计数；缺 usage 时返回 null。 */
    function usageTotals(usage) {
      if (!usage || typeof usage !== 'object') return null;
      const uncached = Number(usage.inputTokens) || 0;
      const cacheRead = Number(usage.cacheReadTokens) || 0;
      const cacheWrite = Number(usage.cacheWriteTokens) || 0;
      const input = uncached + cacheRead + cacheWrite;
      const output = Number(usage.outputTokens) || 0;
      if (input === 0 && output === 0) return null;
      const reasoning = Number(usage.reasoningTokens) || 0;
      const cacheHit = input === 0 ? null : Math.round((cacheRead / input) * 100);
      return {
        input: input,
        output: output,
        reasoning: reasoning,
        cacheHit: cacheHit,
        uncached: uncached,
        cacheRead: cacheRead,
        cacheWrite: cacheWrite,
      };
    }

    /** 聊天用的模型选择；null 表示跟随 DSH 的默认模型。 */
    function loadModelChoice() {
      try {
        const raw = window.localStorage.getItem(STORE_MODEL);
        if (typeof raw !== 'string' || raw === '') return null;
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.provider === 'string' &&
          typeof parsed.model === 'string' &&
          parsed.provider !== '' &&
          parsed.model !== ''
        ) {
          return { provider: parsed.provider, model: parsed.model };
        }
      } catch (error) {
        /* ignore a corrupt choice */
      }
      return null;
    }

    function saveModelChoice(choice) {
      try {
        if (choice === null) window.localStorage.removeItem(STORE_MODEL);
        else window.localStorage.setItem(STORE_MODEL, JSON.stringify(choice));
      } catch (error) {
        /* ignore quota errors */
      }
    }

    const DEFAULT_EXPORT_DIR = '';
    const DRAWER_MS = 200;
    /** 删除后允许撤销的时间窗（毫秒）；超过就真的没了。 */
    const UNDO_MS = 8000;

    /* ------------------------------------------------------------------ copy */

    const zh = {
      'panel.label': '对话模式',
      'app.name': 'DeepSeek',
      'action.newChat': '开启新对话',
      'action.collapse': '收起边栏',
      'action.expand': '打开边栏',
      'action.send': '发送',
      'action.stop': '停止生成',
      'action.settings': '设置',
      'action.delete': '删除对话',
      'action.copy': '复制',
      'action.copied': '已复制',
      'action.fork': '分叉',
      'action.edit': '编辑',
      'edit.title': '编辑消息',
      'edit.field': '消息内容',
      'edit.submit': '保存并重新生成',
      'edit.hint': '保存后从这条消息重新回答，之后的内容会被丢弃。',
      'fork.suffix': '分叉',
      'toast.forked': '已分叉到新对话',
      'action.regenerate': '重新生成',
      'action.attach': '上传图片或文件',
      'action.jumpBottom': '回到底部',
      'action.voice': '语音输入',
      'action.voiceStop': '停止录音',
      'action.retry': '重试',
      'greeting': '今天有什么可以帮到你？',
      'caveat': '内容由 AI 生成，请仔细甄别',
      'placeholder': '请输入消息',
      'toggle.thinking': '深度思考',
      'toggle.search': '智能搜索',
      'group.today': '今天',
      'group.yesterday': '昨天',
      'group.last7': '7 天内',
      'group.last30': '30 天内',
      'list.empty': '还没有对话',
      'settings.title': '设置',
      'settings.theme': '主题',
      'settings.language': '语言',
      'settings.languageHint': '同时切换 DSH 界面语言',
      'settings.fontSize': '字体大小',
      'settings.fontSmall': '小',
      'settings.fontStandard': '标准',
      'settings.fontLarge': '大',
      'settings.autoRead': '自动朗读',
      'settings.ttsVoice': '朗读音色',
      'voice.stella': '海星（女声）',
      'voice.tide': '暗潮（男声）',
      'action.readAloud': '朗读',
      'action.stopReading': '停止朗读',
      'toast.ttsFailed': '朗读失败，请稍后再试',
      'toast.ttsUnavailable': '这条回答暂时无法朗读',
      'toast.ttsNoKey': '没有可用的 API Key，无法朗读',
      'settings.general': '通用设置',
      'settings.data': '数据管理',
      'settings.upload': '上传',
      'settings.download': '下载',
      'settings.change': '更改',
      'settings.delete': '删除',
      'settings.import': '导入历史对话',
      'settings.importHint': '选择导出的 JSON，或 DeepSeek 官方导出的 ZIP',
      'settings.export': '导出历史对话',
      'settings.exportHint': '保存到 Download',
      'settings.location': '导出位置',
      'settings.locationHint': '打开文件管理选择',
      'settings.locationSet': '导出位置：{path}',
      'settings.locationDefault': '默认（系统下载目录）',
      'settings.exportOfficial': '导出 DeepSeek 格式',
      'settings.exportOfficialHint': '与官方 App 相同的 ZIP 结构（manifest / chat_session_index / chat_sessions）',
      'settings.browse': '选择导出文件夹',
      'settings.browseBack': '返回设置',
      'settings.browseUp': '上级',
      'settings.browseHere': '导出到此处',
      'settings.browseEmpty': '这里没有子文件夹',
      'settings.browseFailed': '无法读取该文件夹',
      'settings.browsing': '读取中…',
      'settings.storageInternal': '内部存储',
      'settings.quickDownloads': '下载',
      'settings.quickDocuments': '文档',
      'settings.quickHome': '主目录',
      'settings.deleteAll': '删除所有对话',
      'settings.deleteAllHint': '不可恢复',
      'settings.deleteAllAsk': '删除所有对话？',
      'settings.deleteAllWarn': '删除后所有对话与本地草稿都会被清空，且无法找回。',
      'language.zh': '简体中文',
      'language.en': 'English',
      'action.cancel': '取消',
      'action.confirmDelete': '删除',
      'action.close': '关闭',
      'toast.imported': '已导入 {count} 个对话',
      'toast.importedSkipped': '已导入 {count} 个对话，跳过 {skipped} 个重复',
      'toast.importedNone': '没有新对话，{count} 个都是重复的',
      'toast.importFailed': '导入失败：不是有效的导出文件',
      'import.badZip': '导入失败：无法识别这个 ZIP 文件',
      'import.unsupported': '导入失败：ZIP 使用了不支持的压缩方式',
      'import.noUnzip': '导入失败：当前环境不支持解压',
      'import.noSessions': '导入失败：ZIP 里没有会话文件',
      'toast.storageFull': '本地存储已满，最近的改动可能没有保存',
      'toast.deleted': '已删除 {count} 个对话',
      'toast.undo': '撤销',
      'error.boundary.title': '对话模式出了点问题',
      'error.boundary.desc': '你的本地对话还在。可以点重试，或切换到别的面板再回来。',
      'error.boundary.retry': '重试',
      'toast.exported': '已导出：{path}',
      'toast.exportFailed': '导出失败，请重试',
      'theme.system': '跟随系统',
      'theme.light': '浅色',
      'theme.dark': '深色',
      'thinking.running': '深度思考中…',
      'thinking.done': '已思考',
      'stopped': '已停止生成',
      'error.prefix': '生成失败：',
      'toast.micDenied': '无法访问麦克风，请检查系统权限',
      'toast.asrFailed': '语音识别失败',
      'toast.emptyTranscript': '没有识别到内容',
      'toast.tooShort': '录音太短，请再说一次',
      'toast.fileTooLarge': '文本文件超过 32 MB',
      'toast.imageTooLarge': '图片超过 64 MB',
      'toast.fileUnsupported': '只支持文本类文件（代码、txt、md、csv 等）',
      'toast.imageUnsupported': '图片读取失败',
      'toast.fileLimit': '最多附带 50 个文件',
      'toast.network': '服务未响应，请稍后重试',
      'transcribing': '识别中…',
      'search.running': '正在搜索网页…',
      'search.failed': '联网搜索暂不可用',
      'search.count': '已阅读 {count} 个网页',
      'search.placeholder': '搜索对话',
      'search.clear': '清除',
      'search.empty': '没有匹配的对话',
      'group.pinned': '置顶',
      'menu.open': '更多操作',
      'menu.rename': '重命名',
      'menu.pin': '置顶',
      'menu.unpin': '取消置顶',
      'menu.multi': '多选',
      'menu.export': '导出',
      'menu.exportJson': '导出 JSON',
      'menu.exportMarkdown': '导出 Markdown',
      'menu.delete': '删除',
      'find.open': '查找',
      'find.placeholder': '在当前对话中查找',
      'find.none': '无匹配',
      'find.prev': '上一个匹配',
      'find.next': '下一个匹配',
      'find.close': '关闭查找',
      'model.pick': '选择模型',
      'model.default': '默认模型',
      'model.followDefault': '跟随默认',
      'update.current': '当前版本 v{version}',
      'update.checking': '正在检查最新版本…',
      'update.latest': '已是最新版本 v{version}',
      'update.available': '发现新版本 v{version}',
      'update.failed': '检查失败，请稍后再试',
      'update.check': '检查更新',
      'update.checkingShort': '检查中…',
      'update.latestShort': '已是最新',
      'update.availableShort': '新版本 v{version}',
      'update.failedShort': '检查失败',
      'usage.context': '上下文 {percent}%（约 {used} / {window} tokens）',
      'usage.input': '未缓存输入',
      'usage.output': '输出',
      'usage.reasoning': '推理',
      'usage.cacheHit': '缓存命中',
      'usage.panelTurn': '本轮用量',
      'usage.panelContext': '上下文用量',
      'usage.uncached': '未缓存输入',
      'usage.cacheRead': '缓存读取',
      'usage.cacheWrite': '缓存写入',
      'usage.total': '总计',
      'usage.remaining': '剩余约 {tokens} tokens',
      'usage.approx': '按上一轮计费输入 + 本轮输出估算，不是 provider 的精确压力值',
      'usage.close': '关闭',
      'usage.system': '系统提示',
      'usage.messages': '对话内容',
      'usage.tools': '工具调用',
      'rename.title': '重命名对话',
      'rename.field': '对话标题',
      'rename.save': '保存',
      'delete.title': '删除后，该对话将不可恢复',
      'delete.titleMulti': '删除后，选中的 {count} 个对话将不可恢复',
      'delete.undoNote': '8 秒内可在提示条点「撤销」；超过 8 秒就会永久删除。',
      'delete.action': '删除该对话',
      'delete.actionMulti': '删除选中的 {count} 个对话',
      'select.count': '已选 {count} 个',
      'select.pin': '置顶',
      'select.unpin': '取消置顶',
      'select.delete': '删除',
      'select.exit': '取消',
      'select.all': '全选',
      'select.none': '取消全选',
      'select.export': '导出',
    };

    const en = {
      'panel.label': 'Chat mode',
      'app.name': 'DeepSeek',
      'action.newChat': 'Start a new chat',
      'action.collapse': 'Collapse sidebar',
      'action.expand': 'Open sidebar',
      'action.send': 'Send',
      'action.stop': 'Stop generating',
      'action.settings': 'Settings',
      'action.delete': 'Delete conversation',
      'action.copy': 'Copy',
      'action.copied': 'Copied',
      'action.fork': 'Fork',
      'action.edit': 'Edit',
      'edit.title': 'Edit message',
      'edit.field': 'Message',
      'edit.submit': 'Save and regenerate',
      'edit.hint': 'Saving replies again from this message; everything after it is discarded.',
      'fork.suffix': 'fork',
      'toast.forked': 'Forked into a new conversation',
      'action.regenerate': 'Regenerate',
      'action.attach': 'Attach image or file',
      'action.jumpBottom': 'Jump to bottom',
      'action.voice': 'Voice input',
      'action.voiceStop': 'Stop recording',
      'action.retry': 'Retry',
      'greeting': 'What can I help you with today?',
      'caveat': 'Content is AI generated. Please verify important information.',
      'placeholder': 'Enter a message',
      'toggle.thinking': 'Deep thinking',
      'toggle.search': 'Smart search',
      'group.today': 'Today',
      'group.yesterday': 'Yesterday',
      'group.last7': 'Previous 7 days',
      'group.last30': 'Previous 30 days',
      'list.empty': 'No conversations yet',
      'settings.title': 'Settings',
      'settings.theme': 'Theme',
      'settings.language': 'Language',
      'settings.languageHint': 'Also switches the DSH interface language',
      'settings.fontSize': 'Text size',
      'settings.fontSmall': 'Small',
      'settings.fontStandard': 'Standard',
      'settings.fontLarge': 'Large',
      'settings.autoRead': 'Auto read',
      'settings.ttsVoice': 'Read-aloud voice',
      'voice.stella': 'Stella (female)',
      'voice.tide': 'Tide (male)',
      'action.readAloud': 'Read aloud',
      'action.stopReading': 'Stop reading',
      'toast.ttsFailed': 'Failed to read aloud. Please try again later',
      'toast.ttsUnavailable': 'This answer cannot be read aloud right now',
      'toast.ttsNoKey': 'No API key available for read-aloud',
      'settings.general': 'General',
      'settings.data': 'Data',
      'settings.upload': 'Upload',
      'settings.download': 'Download',
      'settings.change': 'Change',
      'settings.delete': 'Delete',
      'settings.import': 'Import conversations',
      'settings.importHint': 'Pick an exported JSON or a DeepSeek export ZIP',
      'settings.export': 'Export conversations',
      'settings.exportHint': 'Saved to Download',
      'settings.location': 'Export folder',
      'settings.locationHint': 'Browse the file manager',
      'settings.locationSet': 'Export folder: {path}',
      'settings.locationDefault': 'Default (system Downloads)',
      'settings.exportOfficial': 'Export DeepSeek format',
      'settings.exportOfficialHint': 'Same ZIP layout as the official app (manifest / chat_session_index / chat_sessions)',
      'settings.browse': 'Choose export folder',
      'settings.browseBack': 'Back to settings',
      'settings.browseUp': 'Up',
      'settings.browseHere': 'Export here',
      'settings.browseEmpty': 'No sub-folders here',
      'settings.browseFailed': 'Cannot read this folder',
      'settings.browsing': 'Loading…',
      'settings.storageInternal': 'Internal storage',
      'settings.quickDownloads': 'Downloads',
      'settings.quickDocuments': 'Documents',
      'settings.quickHome': 'Home',
      'settings.deleteAll': 'Delete all conversations',
      'settings.deleteAllHint': 'cannot be undone',
      'settings.deleteAllAsk': 'Delete all conversations?',
      'settings.deleteAllWarn': 'Every conversation and local draft will be erased permanently.',
      'language.zh': '简体中文',
      'language.en': 'English',
      'action.cancel': 'Cancel',
      'action.confirmDelete': 'Delete',
      'action.close': 'Close',
      'toast.imported': 'Imported {count} conversations',
      'toast.importedSkipped': 'Imported {count} conversations, skipped {skipped} duplicates',
      'toast.importedNone': 'No new conversations — {count} duplicates skipped',
      'toast.importFailed': 'Import failed: not a valid export file',
      'import.badZip': 'Import failed: this ZIP file could not be read',
      'import.unsupported': 'Import failed: unsupported compression in the ZIP',
      'import.noUnzip': 'Import failed: this environment cannot unzip files',
      'import.noSessions': 'Import failed: the ZIP has no conversation files',
      'toast.storageFull': 'Local storage is full — recent changes may not be saved',
      'toast.deleted': 'Deleted {count} conversations',
      'toast.undo': 'Undo',
      'error.boundary.title': 'Chat mode hit a problem',
      'error.boundary.desc': 'Your local conversations are still here. Retry, or switch to another panel and come back.',
      'error.boundary.retry': 'Retry',
      'toast.exported': 'Exported to {path}',
      'toast.exportFailed': 'Export failed, try again',
      'theme.system': 'System',
      'theme.light': 'Light',
      'theme.dark': 'Dark',
      'thinking.running': 'Thinking…',
      'thinking.done': 'Thought process',
      'stopped': 'Generation stopped',
      'error.prefix': 'Generation failed: ',
      'toast.micDenied': 'Microphone unavailable — check the app permission',
      'toast.asrFailed': 'Speech recognition failed',
      'toast.emptyTranscript': 'No speech detected',
      'toast.tooShort': 'Recording too short',
      'toast.fileTooLarge': 'Text files are limited to 32 MB',
      'toast.imageTooLarge': 'Images are limited to 64 MB',
      'toast.fileUnsupported': 'Text files only (code, txt, md, csv…)',
      'toast.imageUnsupported': 'Could not read this image',
      'toast.fileLimit': 'At most 50 attachments',
      'toast.network': 'The service did not respond — try again',
      'transcribing': 'Transcribing…',
      'search.running': 'Searching the web…',
      'search.failed': 'Web search is unavailable',
      'search.count': 'Read {count} web pages',
      'search.placeholder': 'Search conversations',
      'search.clear': 'Clear',
      'search.empty': 'No matching conversations',
      'group.pinned': 'Pinned',
      'menu.open': 'More actions',
      'menu.rename': 'Rename',
      'menu.pin': 'Pin to top',
      'menu.unpin': 'Unpin',
      'menu.multi': 'Select',
      'menu.export': 'Export',
      'menu.exportJson': 'Export JSON',
      'menu.exportMarkdown': 'Export Markdown',
      'menu.delete': 'Delete',
      'find.open': 'Find',
      'find.placeholder': 'Find in this conversation',
      'find.none': 'No matches',
      'find.prev': 'Previous match',
      'find.next': 'Next match',
      'find.close': 'Close find',
      'model.pick': 'Choose model',
      'model.default': 'Default model',
      'model.followDefault': 'Use default',
      'update.current': 'Current version v{version}',
      'update.checking': 'Checking the latest release…',
      'update.latest': 'Up to date: v{version}',
      'update.available': 'New version available: v{version}',
      'update.failed': 'Check failed, try again later',
      'update.check': 'Check for updates',
      'update.checkingShort': 'Checking…',
      'update.latestShort': 'Up to date',
      'update.availableShort': 'v{version} available',
      'update.failedShort': 'Check failed',
      'usage.context': 'Context {percent}% (~{used} / {window} tokens)',
      'usage.input': 'Uncached input',
      'usage.output': 'Output',
      'usage.reasoning': 'Reasoning',
      'usage.cacheHit': 'Cache hit',
      'usage.panelTurn': 'Turn usage',
      'usage.panelContext': 'Context usage',
      'usage.uncached': 'Uncached input',
      'usage.cacheRead': 'Cached input',
      'usage.cacheWrite': 'Cache write',
      'usage.total': 'Total',
      'usage.remaining': '~{tokens} tokens left',
      'usage.approx': 'Estimated from the last billed input plus this turn’s output, not a provider-exact pressure reading',
      'usage.close': 'Close',
      'usage.system': 'System prompt',
      'usage.messages': 'Conversation',
      'usage.tools': 'Tool calls',
      'rename.title': 'Rename conversation',
      'rename.field': 'Conversation title',
      'rename.save': 'Save',
      'delete.title': 'This conversation cannot be restored after deletion',
      'delete.titleMulti': 'The selected {count} conversations cannot be restored after deletion',
      'delete.undoNote': 'You can undo within 8 seconds from the toast; after that it is permanent.',
      'delete.action': 'Delete conversation',
      'delete.actionMulti': 'Delete {count} conversations',
      'select.count': '{count} selected',
      'select.pin': 'Pin',
      'select.unpin': 'Unpin',
      'select.delete': 'Delete',
      'select.exit': 'Cancel',
      'select.all': 'Select all',
      'select.none': 'Clear',
      'select.export': 'Export',
    };

    /* ----------------------------------------------------------- seed content */

    const HOUR = 3600000;
    const DAY = 86400000;
    const BOOT = Date.now();

    const SEED = [
      {
        id: 'c1',
        title: '帮我写一个防抖函数',
        updatedAt: BOOT - 2 * HOUR,
        messages: [
          { id: 'c1u', role: 'user', text: '用 JavaScript 写一个防抖函数，并说明适用场景。' },
          {
            id: 'c1a',
            role: 'assistant',
            text:
              '可以，这是一个常用实现：\n\n' +
              '```js\nfunction debounce(fn, wait = 300) {\n  let timer = null;\n  return function (...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), wait);\n  };\n}\n```\n\n' +
              '适合输入联想、窗口缩放、按钮防连点这类高频但只需要最后一次结果的场景；需要立即执行或取消防抖时，再补一个 `immediate` 参数即可。',
          },
        ],
      },
      {
        id: 'c2',
        title: 'React 19 的 use 解决了什么',
        updatedAt: BOOT - 26 * HOUR,
        messages: [
          { id: 'c2u', role: 'user', text: 'React 19 引入的 use() 主要是解决什么问题？' },
          {
            id: 'c2a',
            role: 'assistant',
            text:
              '`use()` 把「读取一个异步资源」变成了可以在渲染中直接书写的操作：\n\n' +
              '- 组件里不再需要 `useEffect` + 状态机来等待 Promise\n- Suspense 负责加载态与错误边界\n- 与 `cache()` 配合后，同一份数据在一次渲染中只请求一次\n\n' +
              '注意它仍然受渲染规则约束：只能在组件或 Hook 内部调用，条件调用则会影响内部缓存的一致性。',
          },
        ],
      },
      {
        id: 'c3',
        title: '杭州两天一夜怎么安排',
        updatedAt: BOOT - 3 * DAY,
        messages: [
          { id: 'c3u', role: 'user', text: '周末去杭州两天一夜，第一次去，怎么安排比较顺？' },
          {
            id: 'c3a',
            role: 'assistant',
            text:
              '建议把住宿放在龙翔桥或凤起路附近，地铁与西湖都方便。\n\n' +
              '第一天下午到西湖东岸，沿湖走到北山街看日落；第二天一早去灵隐寺，避开人流，中午回市区吃饭再返程。断桥和南山路傍晚人最多，能错开就错开。',
          },
        ],
      },
      {
        id: 'c4',
        title: '把这段周报改得更正式一些',
        updatedAt: BOOT - 5 * DAY,
        messages: [
          { id: 'c4u', role: 'user', text: '把“这周把登录弄好了，其他没啥进展”改得更正式一些。' },
          {
            id: 'c4a',
            role: 'assistant',
            text:
              '本周完成了登录模块的开发与联调，已具备可用状态；其余事项仍在推进中，暂无阶段性结论。\n\n' +
              '如果需要更完整，可以补上登录模块的验收范围与下周计划，让信息量更均衡。',
          },
        ],
      },
      {
        id: 'c5',
        title: 'SQL 索引失效的常见原因',
        updatedAt: BOOT - 20 * DAY,
        messages: [
          { id: 'c5u', role: 'user', text: 'MySQL 里索引为什么会突然不生效？' },
          {
            id: 'c5a',
            role: 'assistant',
            text:
              '最常见的是这几种：\n\n- 列上做了函数或隐式类型转换\n- 前导模糊查询 `LIKE \'%abc\'`\n- 联合索引没有命中前导列\n- 优化器估算回表成本过高，主动放弃索引\n\n' +
              '先看 `EXPLAIN` 的 `possible_keys` 与 `rows`，再决定是改 SQL 还是补索引。',
          },
        ],
      },
    ];

    /* ----------------------------------------------------------------- icons */

    const ICONS = {
      menu: [['path', { d: 'M4 7h16M4 12h11M4 17h16' }]],
      plus: [['path', { d: 'M12 5v14M5 12h14' }]],
      sidebar: [
        ['rect', { x: 3, y: 4.5, width: 18, height: 15, rx: 3 }],
        ['path', { d: 'M9.5 4.5v15' }],
      ],
      gear: [
        ['circle', { cx: 12, cy: 12, r: 3.2 }],
        [
          'path',
          {
            d:
              'M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3L5.6 5.6',
          },
        ],
      ],
      arrowUp: [['path', { d: 'M12 19V5M6 11l6-6 6 6' }]],
      chevronDown: [['path', { d: 'M6 9.5l6 6 6-6' }]],
      stop: [['rect', { x: 8.5, y: 8.5, width: 7, height: 7, rx: 1.8, fill: 'currentColor', stroke: 'none' }]],
      copy: [
        ['rect', { x: 9, y: 9, width: 11, height: 11, rx: 2.5 }],
        ['path', { d: 'M15 5.5H6.5A2.5 2.5 0 0 0 4 8v8.5' }],
      ],
      refresh: [
        ['path', { d: 'M20.5 12a8.5 8.5 0 1 1-2.5-6' }],
        ['path', { d: 'M20.5 4.5V10H15' }],
      ],
      sparkle: [
        ['path', { d: 'M12 3.2l1.9 4.9 4.9 1.9-4.9 1.9L12 16.8l-1.9-4.9L5.2 10l4.9-1.9z' }],
        ['path', { d: 'M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z' }],
      ],
      globe: [
        ['circle', { cx: 12, cy: 12, r: 8.5 }],
        ['path', { d: 'M3.6 12h16.8M12 3.5c2.3 2.4 2.3 14.6 0 17M12 3.5c-2.3 2.4-2.3 14.6 0 17' }],
      ],
      trash: [
        ['path', { d: 'M4 7h16M9.5 7V4.8h5V7M6.5 7l.8 12.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7' }],
        ['path', { d: 'M10.2 11v6M13.8 11v6' }],
      ],
      check: [['path', { d: 'M5 12.5l4.5 4.5L19 7' }]],
      more: [
        ['circle', { cx: 5, cy: 12, r: 1.5, fill: 'currentColor', stroke: 'none' }],
        ['circle', { cx: 12, cy: 12, r: 1.5, fill: 'currentColor', stroke: 'none' }],
        ['circle', { cx: 19, cy: 12, r: 1.5, fill: 'currentColor', stroke: 'none' }],
      ],
      pencil: [
        ['path', { d: 'M4 20h4.2L19.4 8.8a2.2 2.2 0 0 0 0-3.1l-1.1-1.1a2.2 2.2 0 0 0-3.1 0L4 15.8V20Z' }],
        ['path', { d: 'M14.6 5.9l3.5 3.5' }],
      ],
      pin: [
        ['path', { d: 'M9.1 3.9h5.8l-.6 5.1 2.9 2.9a.75.75 0 0 1-.53 1.28H7.33a.75.75 0 0 1-.53-1.28l2.9-2.9-.6-5.1Z' }],
        ['path', { d: 'M12 13.2v7' }],
      ],
      pinOff: [
        ['path', { d: 'M9.1 3.9h5.8l-.6 5.1 2.9 2.9a.75.75 0 0 1-.53 1.28H7.33a.75.75 0 0 1-.53-1.28l2.9-2.9-.6-5.1Z' }],
        ['path', { d: 'M12 13.2v7M4.5 19.5l15-15' }],
      ],
      checkSquare: [
        ['rect', { x: 3.8, y: 3.8, width: 16.4, height: 16.4, rx: 4.2 }],
        ['path', { d: 'M8.2 12.1l2.9 2.9 5.3-5.6' }],
      ],
      paperclip: [
        ['path', { d: 'M20.2 11.6l-8.3 8.3a4.55 4.55 0 0 1-6.4-6.4l8.5-8.5a3.05 3.05 0 0 1 4.3 4.3l-8.5 8.5a1.55 1.55 0 0 1-2.2-2.2l7.7-7.7' }],
      ],
      mic: [
        ['rect', { x: 9, y: 3, width: 6, height: 11, rx: 3 }],
        ['path', { d: 'M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6' }],
      ],
      x: [['path', { d: 'M6.5 6.5l11 11M17.5 6.5l-11 11' }]],
      search: [
        ['circle', { cx: 11, cy: 11, r: 6.2 }],
        ['path', { d: 'M15.6 15.6L20 20' }],
      ],
      download: [
        ['path', { d: 'M12 4v11' }],
        ['path', { d: 'M7.5 10.5L12 15l4.5-4.5' }],
        ['path', { d: 'M4.5 18.5h15' }],
      ],
      fork: [
        ['circle', { cx: 7, cy: 6.5, r: 2 }],
        ['circle', { cx: 7, cy: 17.5, r: 2 }],
        ['circle', { cx: 17, cy: 11, r: 2 }],
        ['path', { d: 'M7 8.5v7M9 6.5h3.5a4.5 4.5 0 0 1 4.5 4.5' }],
      ],
      chevronLeft: [['path', { d: 'M14.5 6l-6 6 6 6' }]],
      chevronDown: [['path', { d: 'M6 9.5l6 6 6-6' }]],
      chevronUp: [['path', { d: 'M6 14.5l6-6 6 6' }]],
      volume: [
        ['path', { d: 'M4.6 9.4h3.2L12.4 6v12l-4.6-3.4H4.6a.7.7 0 0 1-.7-.7v-3.8a.7.7 0 0 1 .7-.7z' }],
        ['path', { d: 'M15.6 9.1a4.7 4.7 0 0 1 0 5.8M18.6 6.4a8.6 8.6 0 0 1 0 11.2' }],
      ],
      volumeOff: [
        ['path', { d: 'M4.6 9.4h3.2L12.4 6v12l-4.6-3.4H4.6a.7.7 0 0 1-.7-.7v-3.8a.7.7 0 0 1 .7-.7z' }],
        ['path', { d: 'M16.2 8.6l6.2 7.2' }],
      ],
      sun: [
        ['circle', { cx: 12, cy: 12, r: 4 }],
        ['path', { d: 'M12 2.8v2.2M12 19v2.2M21.2 12H19M5 12H2.8M18.5 5.5l-1.6 1.6M7.1 16.9l-1.6 1.6M18.5 18.5l-1.6-1.6M7.1 7.1L5.5 5.5' }],
      ],
      moon: [['path', { d: 'M20 14.2A8.4 8.4 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2z' }]],
      monitor: [
        ['rect', { x: 3, y: 4.5, width: 18, height: 12, rx: 2.5 }],
        ['path', { d: 'M9 20h6M12 16.5V20' }],
      ],
      database: [
        ['ellipse', { cx: 12, cy: 6, rx: 7, ry: 3 }],
        ['path', { d: 'M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6' }],
        ['path', { d: 'M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3' }],
      ],
      folder: [['path', { d: 'M3.5 7.5A2 2 0 0 1 5.5 5.5h3.2l1.8 2h8A2 2 0 0 1 20.5 9.5v7A2 2 0 0 1 18.5 18.5h-13a2 2 0 0 1-2-2z' }]],
      alert: [
        ['circle', { cx: 12, cy: 12, r: 8.5 }],
        ['path', { d: 'M12 7.5v5M12 16h.01' }],
      ],
      file: [
        ['path', { d: 'M13.5 3.5H7A2 2 0 0 0 5 5.5v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z' }],
        ['path', { d: 'M13.5 3.5V9H19' }],
      ],
    };

    function Icon(props) {
      const size = props.size || 18;
      const shapes = ICONS[props.name] || [];
      const children = shapes.map(function (shape, index) {
        const tag = shape[0];
        const attrs = Object.assign({ key: index }, shape[1]);
        return h(tag, attrs);
      });
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: props.strokeWidth || 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block', flexShrink: 0 },
        },
        children,
      );
    }

    function Logo(props) {
      const size = props.size || 24;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 32 32',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block', flexShrink: 0, color: 'var(--dsw-alias-brand-primary)' },
        },
        h('path', {
          d: 'M4 10.5C4 7.46 6.46 5 9.5 5h13C25.54 5 28 7.46 28 10.5v7c0 3.04-2.46 5.5-5.5 5.5H14l-6.3 4.2A.9.9 0 0 1 6.3 26.4V21.9C4.9 21.1 4 19.7 4 18v-7.5Z',
          fill: 'currentColor',
        }),
        h('path', {
          d: 'M10.5 11.5h11M10.5 16h7',
          stroke: 'var(--dsw-alias-bg-base)',
          strokeWidth: 1.9,
          strokeLinecap: 'round',
        }),
      );
    }

    function PanelIcon(props) {
      const size = props.size || 18;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('path', { d: 'M20 11.6c0 3.5-3.6 6.4-8 6.4-.9 0-1.8-.1-2.6-.3L5 20.4l1-3.1C4.8 16.1 4 14.4 4 12.6 4 9.1 7.6 6.2 12 6.2s8 2.9 8 5.4Z' }),
        h('path', { d: 'M8.6 12h.01M12 12h.01M15.4 12h.01' }),
      );
    }

    /* --------------------------------------------------------------- helpers */

    let sequence = 0;
    function newId(prefix) {
      sequence += 1;
      return `${prefix}${Date.now().toString(36)}${sequence.toString(36)}`;
    }

    /* ------------------------------------------------------------- image store */

    const IMAGE_DB_NAME = 'deepseek-chat-ui-images';
    const IMAGE_STORE = 'images';
    const FILE_STORE = 'files';
    const IMAGE_MAX_DIMENSION = 1600;
    const IMAGE_KEEP_BYTES = 400 * 1024;
    /** Upload limits mirror the DeepSeek app: 50 files, 64 MiB images, 32 MiB text. */
    const ATTACHMENT_LIMIT = 50;
    const IMAGE_FILE_LIMIT = 64 * 1024 * 1024;
    const TEXT_FILE_LIMIT = 32 * 1024 * 1024;
    /** How much of one attachment is actually sent to the model. */
    const REQUEST_TEXT_LIMIT = 200 * 1024;
    /** Very large images are stored as-is instead of being decoded for resizing. */
    const IMAGE_SKIP_RESIZE_BYTES = 8 * 1024 * 1024;
    /** In-memory fallback when IndexedDB is unavailable (tests, private modes). */
    const memoryImages = new Map();
    const memoryFiles = new Map();
    let imageDbPromise = null;

    function imageDb() {
      if (imageDbPromise !== null) return imageDbPromise;
      imageDbPromise = new Promise(function (resolve, reject) {
        if (typeof indexedDB === 'undefined') {
          reject(new Error('no-idb'));
          return;
        }
        const request = indexedDB.open(IMAGE_DB_NAME, 2);
        request.onupgradeneeded = function () {
          if (!request.result.objectStoreNames.contains(IMAGE_STORE)) {
            request.result.createObjectStore(IMAGE_STORE);
          }
          if (!request.result.objectStoreNames.contains(FILE_STORE)) {
            request.result.createObjectStore(FILE_STORE);
          }
        };
        request.onsuccess = function () {
          resolve(request.result);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
      return imageDbPromise;
    }

    /** Persist one image blob; silently falls back to memory storage. */
    async function putImage(id, blob) {
      try {
        const db = await imageDb();
        await new Promise(function (resolve, reject) {
          const tx = db.transaction(IMAGE_STORE, 'readwrite');
          tx.objectStore(IMAGE_STORE).put(blob, id);
          tx.oncomplete = function () {
            resolve();
          };
          tx.onerror = function () {
            reject(tx.error);
          };
        });
      } catch (error) {
        memoryImages.set(id, blob);
      }
    }

    async function getImageBlob(id) {
      if (memoryImages.has(id)) return memoryImages.get(id);
      try {
        const db = await imageDb();
        return await new Promise(function (resolve, reject) {
          const tx = db.transaction(IMAGE_STORE, 'readonly');
          const request = tx.objectStore(IMAGE_STORE).get(id);
          request.onsuccess = function () {
            resolve(request.result || null);
          };
          request.onerror = function () {
            reject(request.error);
          };
        });
      } catch (error) {
        return null;
      }
    }

    /** Persist one text file body (large attachments never enter localStorage). */
    async function putStoredFile(id, content) {
      try {
        const db = await imageDb();
        await new Promise(function (resolve, reject) {
          const tx = db.transaction(FILE_STORE, 'readwrite');
          tx.objectStore(FILE_STORE).put(content, id);
          tx.oncomplete = function () {
            resolve();
          };
          tx.onerror = function () {
            reject(tx.error);
          };
        });
      } catch (error) {
        memoryFiles.set(id, content);
      }
    }

    async function getStoredFileText(id) {
      if (memoryFiles.has(id)) return memoryFiles.get(id);
      try {
        const db = await imageDb();
        const value = await new Promise(function (resolve, reject) {
          const tx = db.transaction(FILE_STORE, 'readonly');
          const request = tx.objectStore(FILE_STORE).get(id);
          request.onsuccess = function () {
            resolve(request.result);
          };
          request.onerror = function () {
            reject(request.error);
          };
        });
        return typeof value === 'string' ? value : null;
      } catch (error) {
        return null;
      }
    }

    /** Downscale before storing; the original survives when resizing is unavailable. */
    async function prepareImageBlob(file) {
      try {
        if (file.size > IMAGE_SKIP_RESIZE_BYTES) return file;
        if (typeof createImageBitmap !== 'function' || typeof document === 'undefined' || !document.createElement) {
          return file;
        }
        const bitmap = await createImageBitmap(file);
        const width = bitmap.width || IMAGE_MAX_DIMENSION;
        const height = bitmap.height || IMAGE_MAX_DIMENSION;
        const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(width, height));
        if (scale >= 1 && file.size <= IMAGE_KEEP_BYTES) {
          bitmap.close();
          return file;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
        if (context === null) {
          bitmap.close();
          return file;
        }
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise(function (resolve) {
          canvas.toBlob(resolve, 'image/webp', 0.82);
        });
        return blob || file;
      } catch (error) {
        return file;
      }
    }

    function mimeForImageName(name) {
      const lower = String(name || '').toLowerCase();
      if (lower.endsWith('.png')) return 'image/png';
      if (lower.endsWith('.gif')) return 'image/gif';
      if (lower.endsWith('.webp')) return 'image/webp';
      if (lower.endsWith('.bmp')) return 'image/bmp';
      return 'image/jpeg';
    }

    /** Resolve one stored image to an object URL, released on unmount. */
    function useImageUrl(imageId) {
      const [url, setUrl] = useState('');
      useEffect(
        function () {
          let alive = true;
          let created = '';
          getImageBlob(imageId).then(function (blob) {
            if (!alive || !blob) return;
            if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
            created = URL.createObjectURL(blob);
            setUrl(created);
          });
          return function () {
            alive = false;
            if (created !== '' && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
              URL.revokeObjectURL(created);
            }
          };
        },
        [imageId],
      );
      return url;
    }

    function ImageChip(props) {
      const url = useImageUrl(props.imageId);
      return h(
        'span',
        { className: 'cd-chip cd-chip-image', title: props.name },
        url === ''
          ? h(Icon, { name: 'file', size: 13 })
          : h('img', { className: 'cd-chip-thumb', src: url, alt: props.name }),
        h('span', { className: 'cd-chip-name' }, props.name),
        props.onRemove
          ? h(
              'button',
              {
                type: 'button',
                className: 'cd-chip-x',
                title: props.removeLabel,
                'aria-label': props.removeLabel,
                onClick: props.onRemove,
              },
              h(Icon, { name: 'x', size: 11 }),
            )
          : null,
      );
    }

    function ImageThumb(props) {
      const url = useImageUrl(props.image.id);
      return h(
        'button',
        {
          type: 'button',
          className: 'cd-img-btn',
          title: props.image.name,
          'aria-label': props.image.name,
          onClick: function () {
            props.onOpen({ name: props.image.name, url: url });
          },
        },
        url === '' ? h('span', { className: 'cd-img-fallback' }, props.image.name) : h('img', { className: 'cd-img-thumb', src: url, alt: props.image.name }),
      );
    }

    /** Message images with a click-through lightbox. */
    function MessageImages(props) {
      const t = props.t;
      const [viewer, setViewer] = useState(null);      useEffect(
        function () {
          if (viewer === null) return;
          const onKey = function (event) {
            if (event.key === 'Escape') setViewer(null);
          };
          window.addEventListener('keydown', onKey);
          return function () {
            window.removeEventListener('keydown', onKey);
          };
        },
        [viewer],
      );
      return h(
        'div',
        { className: 'cd-user-images' + (props.align === 'start' ? ' cd-images-start' : '') },
        props.images.map(function (image) {
          return h(ImageThumb, { key: image.id, image: image, onOpen: setViewer });
        }),
        viewer === null
          ? null
          : h(
              'div',
              {
                className: 'cd-lightbox',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': viewer.name,
                onClick: function () {
                  setViewer(null);
                },
              },
              h('img', { className: 'cd-lightbox-img', src: viewer.url, alt: viewer.name }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'cd-lightbox-close',
                  title: t('action.close'),
                  'aria-label': t('action.close'),
                  onClick: function (event) {
                    event.stopPropagation();
                    setViewer(null);
                  },
                },
                h(Icon, { name: 'x', size: 18 }),
              ),
            ),
      );
    }

    function useMedia(query) {
      const read = function () {
        return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : true;
      };
      const [matches, setMatches] = useState(read);
      useEffect(
        function () {
          if (typeof window === 'undefined' || !window.matchMedia) return undefined;
          const mq = window.matchMedia(query);
          const onChange = function () {
            setMatches(mq.matches);
          };
          onChange();
          if (mq.addEventListener) mq.addEventListener('change', onChange);
          else if (mq.addListener) mq.addListener(onChange);
          return function () {
            if (mq.removeEventListener) mq.removeEventListener('change', onChange);
            else if (mq.removeListener) mq.removeListener(onChange);
          };
        },
        [query],
      );
      return matches;
    }

    function startOfDay(value) {
      const date = new Date(value);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }

    /** 消息时间戳渲染成 HH:MM；缺失或非法时不显示。 */
    function formatClock(value) {
      if (typeof value !== 'number') return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    }

    function groupThreads(threads, t) {
      const today = startOfDay(Date.now());
      const pinned = threads
        .filter(function (thread) {
          return typeof thread.pinnedAt === 'number';
        })
        .sort(function (a, b) {
          return b.pinnedAt - a.pinnedAt;
        });
      const sorted = threads
        .filter(function (thread) {
          return typeof thread.pinnedAt !== 'number';
        })
        .slice()
        .sort(function (a, b) {
          return b.updatedAt - a.updatedAt;
        });
      const groups = [];
      /** 置顶单独成组，始终排在日期分组之前。 */
      if (pinned.length > 0) {
        groups.push({ key: 'pinned', label: t('group.pinned'), items: pinned, pinned: true });
      }
      sorted.forEach(function (thread) {
        const days = Math.round((today - startOfDay(thread.updatedAt)) / DAY);
        const key = days <= 0 ? 'today' : days <= 1 ? 'yesterday' : days < 7 ? 'last7' : 'last30';
        let group = groups.find(function (item) {
          return item.key === key;
        });
        if (!group) {
          group = { key: key, label: t('group.' + key), items: [] };
          groups.push(group);
        }
        group.items.push(thread);
      });
      return groups;
    }

    function loadPrefs() {
      try {
        const raw = window.localStorage.getItem(STORE_PREFS);
        const stored = raw ? JSON.parse(raw) : null;
        if (stored !== null && typeof stored === 'object') {
          return { thinking: stored.thinking !== false, search: stored.search === true };
        }
      } catch (error) {
        /* fall through to the defaults */
      }
      return { thinking: true, search: false };
    }

    const VOICE_IDS = ['stella', 'tide'];

    function isVoiceId(value) {
      return VOICE_IDS.indexOf(value) >= 0;
    }

    function loadTts() {
      try {
        const raw = window.localStorage.getItem(STORE_TTS);
        const stored = raw ? JSON.parse(raw) : null;
        if (stored !== null && typeof stored === 'object') {
          return { voice: isVoiceId(stored.voice) ? stored.voice : 'stella', auto: stored.auto === true };
        }
      } catch (error) {
        /* fall through to the defaults */
      }
      return { voice: 'stella', auto: false };
    }

    function saveTts(voice, auto) {
      try {
        window.localStorage.setItem(STORE_TTS, JSON.stringify({ voice: voice, auto: auto }));
      } catch (error) {
        /* the choice still applies for this page */
      }
    }

    /** 正文字号三档；CSS 变量 --cd-text-size 是唯一出口。 */
    const FONT_IDS = ['small', 'standard', 'large'];
    const FONT_SIZES = { small: '14px', standard: '16px', large: '18px' };

    function loadFontSize() {
      try {
        const raw = window.localStorage.getItem(STORE_FONT);
        if (FONT_IDS.indexOf(raw) >= 0) return raw;
      } catch (error) {
        /* fall through to the default */
      }
      return 'standard';
    }

    function saveFontSize(id) {
      try {
        window.localStorage.setItem(STORE_FONT, id);
      } catch (error) {
        /* the choice still applies for this page */
      }
    }

    function loadExportDir() {
      try {
        const raw = window.localStorage.getItem(STORE_EXPORT_DIR);
        if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
      } catch (error) {
        /* fall through to the default */
      }
      return DEFAULT_EXPORT_DIR;
    }

    function loadState() {
      let threads = SEED;
      let activeId = null;
      try {
        const raw = window.localStorage.getItem(STORE_THREADS);
        const stored = raw ? JSON.parse(raw) : null;
        // 空数组是「用户删光了」的合法状态，不能退回演示种子。
        if (Array.isArray(stored)) {
          threads = stored;
          const saved = window.localStorage.getItem(STORE_ACTIVE);
          const known = stored.some(function (thread) {
            return thread.id === saved;
          });
          activeId = known ? saved : null;
        }
      } catch (error) {
        /* a corrupt store falls back to the seed */
      }
      return { threads: threads, activeId: activeId, prefs: loadPrefs() };
    }

    /** 每条对话各存一份草稿；新建对话视图用 DRAFT_NEW 作键。 */
    function loadDrafts() {
      const out = {};
      try {
        const raw = window.localStorage.getItem(STORE_DRAFTS);
        const stored = raw ? JSON.parse(raw) : null;
        if (stored !== null && typeof stored === 'object') {
          Object.keys(stored).forEach(function (key) {
            if (typeof stored[key] === 'string' && stored[key] !== '') out[key] = stored[key];
          });
        }
      } catch (error) {
        /* a corrupt store starts empty */
      }
      return out;
    }

    /** 只保留 usage 的数值字段；非法数据直接丢弃。 */
    function pickUsage(value) {
      if (value === null || typeof value !== 'object') return null;
      const out = {};
      ['inputTokens', 'outputTokens', 'totalTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens'].forEach(
        function (key) {
          const number = value[key];
          if (typeof number === 'number' && Number.isFinite(number) && number >= 0) out[key] = Math.round(number);
        },
      );
      return out.inputTokens === undefined && out.outputTokens === undefined ? null : out;
    }

    /** Accept our own export shape (or a bare array) and rebuild safe threads. */
    function normalizeThreads(list) {
      const out = [];
      for (const item of Array.isArray(list) ? list : []) {
        if (item === null || typeof item !== 'object') continue;
        const messages = [];
        for (const message of Array.isArray(item.messages) ? item.messages : []) {
          if (message === null || typeof message !== 'object') continue;
          if (message.role !== 'user' && message.role !== 'assistant') continue;
          if (typeof message.text !== 'string') continue;
          const files = Array.isArray(message.files)
            ? message.files
                .filter(function (file) {
                  return file !== null && typeof file === 'object' && typeof file.name === 'string';
                })
                .map(function (file) {
                  return { name: file.name, text: typeof file.text === 'string' ? file.text : '' };
                })
            : [];
          messages.push({
            id: newId('m'),
            role: message.role,
            text: message.text,
            ...(typeof message.at === 'number' ? { at: message.at } : {}),
            ...(pickUsage(message.usage) === null ? {} : { usage: pickUsage(message.usage) }),
            ...(files.length > 0 ? { files: files } : {}),
          });
        }
        if (messages.length === 0) continue;
        const title =
          typeof item.title === 'string' && item.title.trim() !== ''
            ? item.title.trim().slice(0, 60)
            : messages[0].text.slice(0, 24);
        out.push({
          id: newId('c'),
          title: title,
          updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
          ...(typeof item.pinnedAt === 'number' ? { pinnedAt: item.pinnedAt } : {}),
          messages: messages,
        });
      }
      return out;
    }

    /**
     * Read the JSON entries of a ZIP archive without external libraries.
     * Supports stored (method 0) and deflated (method 8) entries; ZIP64 and
     * encrypted entries are rejected. Only `.json` members are extracted, so a
     * large attachment folder costs nothing.
     *
     * @param buffer - the archive bytes.
     * @returns `{ names, text(name) }` for the JSON members.
     */
    async function readZipJson(buffer) {
      const bytes = new Uint8Array(buffer);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let eocd = -1;
      const stop = Math.max(0, bytes.length - 22 - 65535);
      for (let index = bytes.length - 22; index >= stop; index -= 1) {
        if (view.getUint32(index, true) === 0x06054b50) {
          eocd = index;
          break;
        }
      }
      if (eocd < 0) throw new Error('not-zip');
      const count = view.getUint16(eocd + 10, true);
      const cdOffset = view.getUint32(eocd + 16, true);
      if (count === 0xffff || cdOffset === 0xffffffff) throw new Error('zip64');
      if (cdOffset >= bytes.length) throw new Error('not-zip');
      const decoder = new TextDecoder('utf-8');
      const entries = new Map();
      let cursor = cdOffset;
      for (let index = 0; index < count; index += 1) {
        if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) break;
        const method = view.getUint16(cursor + 10, true);
        const compressedSize = view.getUint32(cursor + 20, true);
        const nameLength = view.getUint16(cursor + 28, true);
        const extraLength = view.getUint16(cursor + 30, true);
        const commentLength = view.getUint16(cursor + 32, true);
        const localOffset = view.getUint32(cursor + 42, true);
        const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
        cursor += 46 + nameLength + extraLength + commentLength;
        if (!name.endsWith('/')) entries.set(name, { method, compressedSize, localOffset });
      }
      const read = async function (name) {
        const entry = entries.get(name);
        if (entry === undefined) return null;
        const local = entry.localOffset;
        if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) {
          throw new Error('bad-local-header');
        }
        const nameLength = view.getUint16(local + 26, true);
        const extraLength = view.getUint16(local + 28, true);
        const start = local + 30 + nameLength + extraLength;
        const raw = bytes.subarray(start, start + entry.compressedSize);
        if (entry.method === 0) return raw;
        if (entry.method === 8) return inflateRaw(raw);
        throw new Error('unsupported-compression');
      };
      return {
        names: Array.from(entries.keys()),
        async text(name) {
          const data = await read(name);
          return data === null ? null : decoder.decode(data);
        },
        async bytes(name) {
          const data = await read(name);
          return data === null ? null : new Uint8Array(data);
        },
      };
    }

    /** Inflate one raw-deflate member with the platform's DecompressionStream. */
    async function inflateRaw(bytes) {
      if (typeof DecompressionStream !== 'function') throw new Error('unzip-unavailable');
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    /* ------------------------------------------------------------ zip writer */

    const CRC_TABLE = (function () {
      const table = new Uint32Array(256);
      for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        table[index] = value >>> 0;
      }
      return table;
    })();

    function crc32(bytes) {
      let crc = 0xffffffff;
      for (let index = 0; index < bytes.length; index += 1) {
        crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
      }
      return (crc ^ 0xffffffff) >>> 0;
    }

    /** Deflate one member when the platform supports it, else null. */
    async function deflateRaw(bytes) {
      if (typeof CompressionStream !== 'function') return null;
      try {
        const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch (error) {
        return null;
      }
    }

    /** DOS time/date pair for ZIP headers. */
    function zipDateTime(date) {
      return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        date: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
      };
    }

    /**
     * Build a ZIP archive from `{ name, bytes }` entries. Deflate is used when
     * the platform exposes CompressionStream, stored entries otherwise.
     *
     * @param entries - members in write order.
     * @returns the archive bytes.
     */
    async function makeZipArchive(entries) {
      const stamp = zipDateTime(new Date());
      const encoder = new TextEncoder();
      const parts = [];
      const central = [];
      let offset = 0;
      for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const raw = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes);
        const deflated = raw.length >= 2048 ? await deflateRaw(raw) : null;
        const data = deflated !== null && deflated.length < raw.length ? deflated : raw;
        const method = data === raw ? 0 : 8;
        const checksum = crc32(raw);

        const local = new Uint8Array(30 + nameBytes.length);
        const localView = new DataView(local.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(6, 0x0800, true);
        localView.setUint16(8, method, true);
        localView.setUint16(10, stamp.time, true);
        localView.setUint16(12, stamp.date, true);
        localView.setUint32(14, checksum, true);
        localView.setUint32(18, data.length, true);
        localView.setUint32(22, raw.length, true);
        localView.setUint16(26, nameBytes.length, true);
        local.set(nameBytes, 30);
        parts.push(local, data);

        const record = new Uint8Array(46 + nameBytes.length);
        const recordView = new DataView(record.buffer);
        recordView.setUint32(0, 0x02014b50, true);
        recordView.setUint16(4, 20, true);
        recordView.setUint16(6, 20, true);
        recordView.setUint16(8, 0x0800, true);
        recordView.setUint16(10, method, true);
        recordView.setUint16(12, stamp.time, true);
        recordView.setUint16(14, stamp.date, true);
        recordView.setUint32(16, checksum, true);
        recordView.setUint32(20, data.length, true);
        recordView.setUint32(24, raw.length, true);
        recordView.setUint16(28, nameBytes.length, true);
        recordView.setUint32(42, offset, true);
        record.set(nameBytes, 46);
        central.push(record);
        offset += local.length + data.length;
      }
      const centralSize = central.reduce(function (sum, record) {
        return sum + record.length;
      }, 0);
      const eocd = new Uint8Array(22);
      const eocdView = new DataView(eocd.buffer);
      eocdView.setUint32(0, 0x06054b50, true);
      eocdView.setUint16(8, entries.length, true);
      eocdView.setUint16(10, entries.length, true);
      eocdView.setUint32(12, centralSize, true);
      eocdView.setUint32(16, offset, true);
      const total = new Uint8Array(offset + centralSize + 22);
      let cursor = 0;
      const all = parts.concat(central);
      for (const part of all) {
        total.set(part, cursor);
        cursor += part.length;
      }
      total.set(eocd, cursor);
      return total;
    }

    /**
     * The visible conversation is the parent chain ending at `current_message_id`
     * — not the file order (branches) and not the timestamp order: the export
     * stamps an assistant entry a few milliseconds *before* its request, so
     * sorting by time swaps every user/assistant pair.
     *
     * @param messages - raw `session.messages`.
     * @param currentId - `session.current_message_id` (the active leaf).
     * @returns messages ordered from the root to the active leaf.
     */
    function orderOfficialMessages(messages, currentId) {
      const list = messages.filter(function (message) {
        return message !== null && typeof message === 'object';
      });
      const byId = new Map();
      for (const message of list) {
        if (message.id !== undefined && message.id !== null) byId.set(String(message.id), message);
      }
      const hasCurrent = currentId !== undefined && currentId !== null && byId.has(String(currentId));
      const leaf = hasCurrent ? byId.get(String(currentId)) : list[list.length - 1];
      const chain = [];
      const seen = new Set();
      let cursor = leaf;
      while (cursor && !seen.has(String(cursor.id))) {
        chain.push(cursor);
        seen.add(String(cursor.id));
        if (cursor.parent_id === undefined || cursor.parent_id === null) break;
        cursor = byId.get(String(cursor.parent_id));
      }
      chain.reverse();
      if (chain.length === list.length) return chain;
      if (hasCurrent && chain.length > 1) return chain;
      return list;
    }

    /**
     * Map one DeepSeek app export session onto this plugin's thread shape.
     * Request/response fragments become the message text, THINK becomes the
     * collapsible reasoning block, FILE entries become attachment chips.
     *
     * @param session - one `chat_sessions/*.json` payload.
     * @returns a normalized thread, or null when nothing usable survives.
     */
    async function threadFromOfficialSession(session, extractImage, extractFile) {
      if (session === null || typeof session !== 'object') return null;
      const source = orderOfficialMessages(
        Array.isArray(session.messages) ? session.messages : [],
        session.current_message_id,
      );
      const messages = [];
      for (const message of source) {
        if (message === null || typeof message !== 'object') continue;
        const role = message.role === 'ASSISTANT' ? 'assistant' : message.role === 'USER' ? 'user' : null;
        if (role === null) continue;
        const texts = [];
        const thinks = [];
        const files = [];
        const images = [];
        for (const fragment of Array.isArray(message.fragments) ? message.fragments : []) {
          if (fragment === null || typeof fragment !== 'object') continue;
          if (
            fragment.type === 'REQUEST' ||
            fragment.type === 'RESPONSE' ||
            fragment.type === 'TEMPLATE_RESPONSE'
          ) {
            if (typeof fragment.content === 'string' && fragment.content.trim() !== '') texts.push(fragment.content);
          } else if (fragment.type === 'THINK') {
            if (typeof fragment.content === 'string' && fragment.content.trim() !== '') thinks.push(fragment.content);
          } else if (fragment.type === 'FILE' && Array.isArray(fragment.files)) {
            for (const file of fragment.files) {
              if (file === null || typeof file !== 'object') continue;
              const name = typeof file.file_name === 'string' ? file.file_name : '';
              if (name === '') continue;
              if (file.is_image === true && typeof extractImage === 'function') {
                const stored = await extractImage(file);
                if (stored !== null) {
                  images.push(stored);
                  continue;
                }
              }
              if (typeof extractFile === 'function') {
                const storedFile = await extractFile(file);
                if (storedFile !== null) {
                  files.push(storedFile);
                  continue;
                }
              }
              files.push({ name: name, text: '' });
            }
          }
        }
        const text = texts.join('\n\n').trim();
        if (text === '' && files.length === 0 && images.length === 0) continue;
        const at = Date.parse(message.inserted_at);
        messages.push({
          id: newId('m'),
          role: role,
          text: text,
          ...(Number.isFinite(at) ? { at: at } : {}),
          ...(thinks.length > 0 ? { reasoning: thinks.join('\n\n') } : {}),
          ...(files.length > 0 ? { files: files } : {}),
          ...(images.length > 0 ? { images: images } : {}),
        });
      }
      if (messages.length === 0) return null;
      const title =
        typeof session.title === 'string' && session.title.trim() !== ''
          ? session.title.trim().slice(0, 60)
          : (messages[0].text || '导入的对话').slice(0, 24);
      const updatedAt = Date.parse(session.updated_at);
      const insertedAt = Date.parse(session.inserted_at);
      return {
        id: newId('c'),
        title: title,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : (messages[messages.length - 1].at || Date.now()),
        ...(session.pinned === true && Number.isFinite(insertedAt) ? { pinnedAt: insertedAt } : {}),
        messages: messages,
      };
    }

    /** Read a whole DeepSeek app export ZIP into normalized threads. */
    async function importOfficialArchive(file) {
      const zip = await readZipJson(await file.arrayBuffer());
      const names = zip.names.filter(function (name) {
        return /^chat_sessions\/[^/]+\.json$/i.test(name);
      });
      if (names.length === 0) throw new Error('no-sessions');
      /** Pull one referenced image out of the archive into the local image store. */
      const extractImage = async function (entry) {
        if (typeof entry.export_path !== 'string' || entry.export_path === '') return null;
        const path = entry.export_path.replace(/^\.?\//, '');
        let data = null;
        try {
          data = await zip.bytes(path);
        } catch (error) {
          data = null;
        }
        if (data === null || data.length === 0) return null;
        const id = newId('img');
        const name = typeof entry.file_name === 'string' ? entry.file_name : 'image';
        await putImage(id, new Blob([data], { type: mimeForImageName(name) }));
        return { id: id, name: name };
      };
      /**
       * Pull one referenced non-image attachment out of the archive. Large text
       * bodies go to IndexedDB so imported conversations stay small in storage.
       */
      const extractFile = async function (entry) {
        if (typeof entry.export_path !== 'string' || entry.export_path === '') return null;
        const path = entry.export_path.replace(/^\.?\//, '');
        let data = null;
        try {
          data = await zip.bytes(path);
        } catch (error) {
          data = null;
        }
        if (data === null || data.length === 0 || data.length > TEXT_FILE_LIMIT) return null;
        let text = '';
        try {
          text = new TextDecoder('utf-8').decode(data);
        } catch (error) {
          return null;
        }
        if (text.indexOf('\u0000') >= 0) return null;
        const name = typeof entry.file_name === 'string' ? entry.file_name : 'file.txt';
        const fileId = newId('file');
        await putStoredFile(fileId, text);
        return { name: name, size: text.length, text: '', fileId: fileId };
      };
      const threads = [];
      for (const name of names) {
        try {
          const parsed = JSON.parse(await zip.text(name));
          const thread = await threadFromOfficialSession(parsed, extractImage, extractFile);
          if (thread !== null) threads.push(thread);
        } catch (error) {
          /* skip one malformed session file instead of failing the whole import */
        }
      }
      if (threads.length === 0) throw new Error('empty');
      return threads;
    }

    /** UUID v4-shaped id for the official schema (which uses UUID strings). */
    function makeUuid() {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (character) {
        const random = Math.floor(Math.random() * 16);
        const value = character === 'x' ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });
    }

    function safeArchiveName(name, fallback) {
      const cleaned = String(name || '')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
      return cleaned === '' ? fallback : cleaned;
    }

    /** Extension for an image path when the display name has none. */
    function imageExtension(type) {
      if (type === 'image/png') return '.png';
      if (type === 'image/gif') return '.gif';
      if (type === 'image/webp') return '.webp';
      if (type === 'image/bmp') return '.bmp';
      return '.jpg';
    }

    function officialTime(value) {
      const date = new Date(typeof value === 'number' && Number.isFinite(value) ? value : Date.now());
      return date.toISOString();
    }

    /**
     * Render one conversation in the official `chat_sessions/*.json` schema.
     * Attachment bytes are collected into `entries` as sibling files.
     *
     * @param thread - normalized conversation.
     * @param entries - archive members this session appends to.
     * @returns the official session object.
     */
    async function officialSessionFromThread(thread, entries) {
      const encoder = new TextEncoder();
      const sessionId = makeUuid();
      const filesDir = 'chat_sessions/' + sessionId + '_files';
      const messages = [];
      for (const message of thread.messages) {
        const id = messages.length + 1;
        const fragments = [];
        const files = [];
        if (message.role === 'user') {
          if (typeof message.text === 'string' && message.text !== '') {
            fragments.push({ type: 'REQUEST', content: message.text });
          }
        } else {
          if (typeof message.reasoning === 'string' && message.reasoning !== '') {
            fragments.push({ type: 'THINK', content: message.reasoning, elapsed_secs: 0 });
          }
          if (typeof message.text === 'string' && message.text !== '') {
            fragments.push({ type: 'RESPONSE', content: message.text });
          }
        }
        let fileIndex = 0;
        for (const file of Array.isArray(message.files) ? message.files : []) {
          fileIndex += 1;
          const name = safeArchiveName(file && file.name, 'file-' + fileIndex + '.txt');
          const path = filesDir + '/' + id + '-' + fileIndex + '-' + name;
          let content = typeof file?.text === 'string' ? file.text : '';
          if (content === '' && typeof file?.fileId === 'string') {
            const stored = await getStoredFileText(file.fileId);
            if (typeof stored === 'string') content = stored;
          }
          const bytes = encoder.encode(content);
          entries.push({ name: path, bytes: bytes });
          files.push({
            id: makeUuid(),
            file_name: name,
            file_size: bytes.length,
            token_usage: 0,
            inserted_at: officialTime(message.at),
            export_path: path,
            is_image: false,
          });
        }
        for (const image of Array.isArray(message.images) ? message.images : []) {
          const blob = await getImageBlob(image && image.id);
          if (!blob) continue;
          fileIndex += 1;
          const name = safeArchiveName(image.name, 'image-' + fileIndex + '.png');
          const suffix = /\.(png|jpe?g|webp|gif|bmp)$/i.test(name) ? '' : imageExtension(blob.type);
          const path = filesDir + '/' + id + '-' + fileIndex + '-' + name + suffix;
          const bytes = new Uint8Array(await blob.arrayBuffer());
          entries.push({ name: path, bytes: bytes });
          files.push({
            id: makeUuid(),
            file_name: name,
            file_size: bytes.length,
            token_usage: 0,
            inserted_at: officialTime(message.at),
            export_path: path,
            is_image: true,
          });
        }
        if (files.length > 0) fragments.push({ type: 'FILE', files: files });
        const totals = usageTotals(message.usage);
        messages.push({
          id: id,
          parent_id: id === 1 ? null : id - 1,
          role: message.role === 'user' ? 'USER' : 'ASSISTANT',
          status: 'FINISHED',
          thinking_enabled: Boolean(message.reasoning),
          search_enabled: false,
          accumulated_token_usage: totals === null ? 0 : totals.input + totals.output,
          inserted_at: officialTime(message.at),
          fragments: fragments,
        });
      }
      const firstAt = thread.messages.length > 0 ? thread.messages[0].at : undefined;
      return {
        id: sessionId,
        title: typeof thread.title === 'string' ? thread.title : '',
        pinned: typeof thread.pinnedAt === 'number',
        current_message_id: messages.length === 0 ? null : messages[messages.length - 1].id,
        inserted_at: officialTime(typeof thread.pinnedAt === 'number' ? thread.pinnedAt : firstAt),
        updated_at: officialTime(thread.updatedAt),
        messages: messages,
      };
    }

    /** Build a ZIP that follows the DeepSeek app export layout. */
    async function buildOfficialArchive(threads) {
      const encoder = new TextEncoder();
      const entries = [];
      const index = [];
      for (const thread of threads) {
        const session = await officialSessionFromThread(thread, entries);
        entries.push({
          name: 'chat_sessions/' + session.id + '.json',
          bytes: encoder.encode(JSON.stringify(session)),
        });
        index.push({
          id: session.id,
          title: session.title,
          pinned: session.pinned,
          message_count: session.messages.length,
          inserted_at: session.inserted_at,
          updated_at: session.updated_at,
        });
      }
      entries.push({ name: 'manifest.json', bytes: encoder.encode(JSON.stringify({ export_format_version: 3 })) });
      entries.push({
        name: 'user.json',
        bytes: encoder.encode(JSON.stringify({ user_id: '', email: '', mobile: null, oauth_profiles: null })),
      });
      entries.push({ name: 'chat_session_index.json', bytes: encoder.encode(JSON.stringify(index)) });
      return makeZipArchive(entries);
    }

    /** Move any inline attachment bodies imported from JSON into IndexedDB. */
    async function offloadFileBodies(threads) {
      for (const thread of threads) {
        for (const message of thread.messages) {
          if (!Array.isArray(message.files)) continue;
          for (const file of message.files) {
            if (typeof file.text !== 'string' || file.text === '') continue;
            const fileId = newId('file');
            await putStoredFile(fileId, file.text);
            file.fileId = fileId;
            file.size = file.text.length;
            file.text = '';
          }
        }
      }
      return threads;
    }

    /** 导入去重用的指纹：标题 + 更新时间 + 消息数 + 首条消息开头。 */
    function threadFingerprint(thread) {
      const first =
        thread.messages.length > 0 && typeof thread.messages[0].text === 'string'
          ? thread.messages[0].text.slice(0, 48)
          : '';
      return [thread.title, thread.updatedAt, thread.messages.length, first].join('\u0001');
    }

    async function exportThread(thread) {
      const messages = [];
      for (const message of thread.messages) {
        const files = [];
        for (const file of Array.isArray(message.files) ? message.files : []) {
          let text = typeof file.text === 'string' ? file.text : '';
          if (text === '' && typeof file.fileId === 'string') {
            const stored = await getStoredFileText(file.fileId);
            if (typeof stored === 'string') text = stored;
          }
          files.push({
            name: file.name,
            text: text,
            ...(typeof file.size === 'number' ? { size: file.size } : {}),
          });
        }
        messages.push({
          role: message.role,
          text: message.text,
          ...(typeof message.at === 'number' ? { at: message.at } : {}),
          ...(pickUsage(message.usage) === null ? {} : { usage: pickUsage(message.usage) }),
          ...(files.length > 0 ? { files: files } : {}),
        });
      }
      return {
        title: thread.title,
        updatedAt: thread.updatedAt,
        ...(typeof thread.pinnedAt === 'number' ? { pinnedAt: thread.pinnedAt } : {}),
        messages: messages,
      };
    }

    function renderInline(text, prefix) {
      const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
      const out = [];
      let last = 0;
      let match;
      let index = 0;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) out.push(text.slice(last, match.index));
        const token = match[0];
        if (token.indexOf('**') === 0) {
          out.push(h('strong', { key: prefix + 's' + index }, token.slice(2, -2)));
        } else {
          out.push(h('code', { key: prefix + 'c' + index }, token.slice(1, -1)));
        }
        index += 1;
        last = match.index + token.length;
      }
      if (last < text.length) out.push(text.slice(last));
      return out;
    }

    function renderTextBlock(chunk, prefix) {
      const lines = chunk.split('\n').filter(function (line) {
        return line.trim() !== '';
      });
      if (lines.length === 0) return null;
      if (
        lines.every(function (line) {
          return /^[-*]\s+/.test(line);
        })
      ) {
        return h(
          'ul',
          { key: prefix },
          lines.map(function (line, index) {
            return h('li', { key: index }, renderInline(line.replace(/^[-*]\s+/, ''), prefix + '-' + index));
          }),
        );
      }
      if (
        lines.every(function (line) {
          return /^\d+\.\s+/.test(line);
        })
      ) {
        return h(
          'ol',
          { key: prefix },
          lines.map(function (line, index) {
            return h('li', { key: index }, renderInline(line.replace(/^\d+\.\s+/, ''), prefix + '-' + index));
          }),
        );
      }
      if (lines.length === 1 && /^#{1,4}\s+/.test(lines[0])) {
        return h('h3', { key: prefix }, renderInline(lines[0].replace(/^#{1,4}\s+/, ''), prefix + '-h'));
      }
      return h('p', { key: prefix }, renderInline(lines.join(' '), prefix + '-p'));
    }

    /** 把一段纯文本按查询词切成「文本 + <mark>」片段（大小写不敏感）。 */
    function highlightText(text, needle, prefix) {
      const lower = text.toLowerCase();
      const wanted = needle.toLowerCase();
      const out = [];
      let from = 0;
      let at = lower.indexOf(wanted);
      let index = 0;
      while (at >= 0) {
        if (at > from) out.push(text.slice(from, at));
        out.push(h('mark', { key: (prefix || '') + 'm' + index, className: 'cd-mark' }, text.slice(at, at + wanted.length)));
        from = at + wanted.length;
        index += 1;
        at = lower.indexOf(wanted, from);
      }
      if (from < text.length) out.push(text.slice(from));
      return out;
    }

    /** 递归遍历 Markdown 渲染出的 React 树，把命中查询的文本包进 <mark>。 */
    function highlightChildren(children, needle, prefix) {
      const out = [];
      children.forEach(function (child, index) {
        if (child === null || child === undefined || child === false) {
          out.push(child);
          return;
        }
        if (typeof child === 'string') {
          highlightText(child, needle, prefix + index + '-').forEach(function (piece) {
            out.push(piece);
          });
          return;
        }
        if (Array.isArray(child)) {
          highlightChildren(child, needle, prefix + index + '-').forEach(function (piece) {
            out.push(piece);
          });
          return;
        }
        if (child.props && Array.isArray(child.props.children)) {
          out.push(
            Object.assign({}, child, {
              props: Object.assign({}, child.props, {
                children: highlightChildren(child.props.children, needle, prefix + index + '-'),
              }),
            }),
          );
          return;
        }
        out.push(child);
      });
      return out;
    }

    function highlightTree(node, needle) {
      if (!node || !node.props || !Array.isArray(node.props.children)) return node;
      return Object.assign({}, node, {
        props: Object.assign({}, node.props, { children: highlightChildren(node.props.children, needle, '') }),
      });
    }

    function Markdown(props) {
      const text = props.text || '';
      const pattern = /```([a-z0-9]*)\n([\s\S]*?)```/g;
      const blocks = [];
      let last = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) blocks.push({ type: 'text', value: text.slice(last, match.index) });
        blocks.push({ type: 'code', value: match[2] });
        last = match.index + match[0].length;
      }
      if (last < text.length) blocks.push({ type: 'text', value: text.slice(last) });
      const children = blocks.map(function (block, index) {
        if (block.type === 'code') {
          return h('pre', { key: 'code-' + index }, h('code', null, block.value));
        }
        return block.value
          .split(/\n{2,}/)
          .map(function (chunk, chunkIndex) {
            return renderTextBlock(chunk, 't' + index + '-' + chunkIndex);
          })
          .filter(Boolean);
      });
      const tree = h('div', { className: 'cd-md' }, children);
      const needle = typeof props.highlight === 'string' ? props.highlight.trim() : '';
      return needle === '' ? tree : highlightTree(tree, needle);
    }

    /* --------------------------------------------------------- audio capture */

    function resample(input, from, to) {
      if (from === to) return input;
      const ratio = from / to;
      const length = Math.max(1, Math.floor(input.length / ratio));
      const output = new Float32Array(length);
      for (let index = 0; index < length; index += 1) {
        const position = index * ratio;
        const before = Math.floor(position);
        const after = Math.min(input.length - 1, before + 1);
        const weight = position - before;
        output[index] = input[before] * (1 - weight) + input[after] * weight;
      }
      return output;
    }

    function encodeWav(samples, sampleRate) {
      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);
      const writeText = function (offset, text) {
        for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
      };
      writeText(0, 'RIFF');
      view.setUint32(4, 36 + samples.length * 2, true);
      writeText(8, 'WAVE');
      writeText(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeText(36, 'data');
      view.setUint32(40, samples.length * 2, true);
      let offset = 44;
      for (let index = 0; index < samples.length; index += 1) {
        const value = Math.max(-1, Math.min(1, samples[index]));
        view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
        offset += 2;
      }
      return buffer;
    }

    async function beginRecording() {
      const media = navigator.mediaDevices;
      if (!media || typeof media.getUserMedia !== 'function') throw new Error('microphone-unavailable');
      const stream = await media.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error('audio-context-unavailable');
      let context;
      try {
        context = new Ctor({ sampleRate: 16000 });
      } catch (error) {
        context = new Ctor();
      }
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(2048, 1, 1);
      const chunks = [];
      processor.onaudioprocess = function (event) {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      const sink = context.createGain();
      sink.gain.value = 0;
      source.connect(processor);
      processor.connect(sink);
      sink.connect(context.destination);
      return {
        context: context,
        stream: stream,
        source: source,
        processor: processor,
        sink: sink,
        chunks: chunks,
        sampleRate: context.sampleRate,
        startedAt: Date.now(),
      };
    }

    async function endRecording(recorder) {
      const seconds = (Date.now() - recorder.startedAt) / 1000;
      try {
        recorder.processor.disconnect();
        recorder.source.disconnect();
        recorder.sink.disconnect();
      } catch (error) {
        /* already torn down */
      }
      recorder.stream.getTracks().forEach(function (track) {
        track.stop();
      });
      const total = recorder.chunks.reduce(function (sum, chunk) {
        return sum + chunk.length;
      }, 0);
      const merged = new Float32Array(total);
      let offset = 0;
      recorder.chunks.forEach(function (chunk) {
        merged.set(chunk, offset);
        offset += chunk.length;
      });
      try {
        await recorder.context.close();
      } catch (error) {
        /* closing an already closed context is fine */
      }
      const samples = recorder.sampleRate === 16000 ? merged : resample(merged, recorder.sampleRate, 16000);
      return { blob: new Blob([encodeWav(samples, 16000)], { type: 'audio/wav' }), seconds: seconds };
    }

    /* -------------------------------------------------------------- settings */

    /* -------------------------------------------------------------- settings */

    /* -------------------------------------------------------------- settings */

    function readThemePreference(service) {
      if (!service) return 'system';
      try {
        return service.getTheme().preference;
      } catch (error) {
        return 'system';
      }
    }


    function loadThemePreference() {
      try {
        const raw = window.localStorage.getItem(STORE_THEME_PREF);
        if (raw === 'system' || raw === 'light' || raw === 'dark') return raw;
      } catch (error) {
        /* fall through to the service preference */
      }
      return null;
    }

    function saveThemePreference(id) {
      try {
        window.localStorage.setItem(STORE_THEME_PREF, id);
      } catch (error) {
        /* the choice still applies for this page */
      }
    }

    /**
     * Resolve 「跟随系统」 through the Host.
     *
     * The WebView's `prefers-color-scheme` follows the app shell rather than the
     * phone's switch, so the page asks the Host (which asks the device) and only
     * falls back to the media query when the bridge cannot answer.
     */
    async function applySystemTheme(service) {
      if (!service) return;
      let scheme = 'unknown';
      try {
        const response = await fetch(API + '/system-theme', { headers: { accept: 'application/json' } });
        if (response.ok) {
          const body = await response.json();
          scheme = body && body.scheme ? body.scheme : 'unknown';
        }
      } catch (error) {
        scheme = 'unknown';
      }
      try {
        service.setTheme(scheme === 'light' || scheme === 'dark' ? scheme : 'system');
      } catch (error) {
        /* an unregistered id keeps the previous theme */
      }
    }

    function readLocaleId(service) {
      if (!service) return 'zh';
      try {
        const active = String(service.getSnapshot().active || 'zh').toLowerCase();
        return active.indexOf('en') === 0 ? 'en' : 'zh';
      } catch (error) {
        return 'zh';
      }
    }

    function shortPath(path) {
      return String(path || '').replace(/^\/sdcard\//, '').replace(/^\/storage\/emulated\/0\//, '');
    }

    /** 比较 `1.2.3` 形式的版本号；返回 -1 / 0 / 1。 */
    function compareVersions(left, right) {
      const parse = function (value) {
        return String(value || '')
          .replace(/^v/i, '')
          .split('.')
          .map(function (part) {
            return parseInt(part, 10) || 0;
          });
      };
      const a = parse(left);
      const b = parse(right);
      const length = Math.max(a.length, b.length);
      for (let index = 0; index < length; index += 1) {
        const x = a[index] || 0;
        const y = b[index] || 0;
        if (x !== y) return x < y ? -1 : 1;
      }
      return 0;
    }

    /**
     * 设置面板：通用设置（主题 / 语言）与数据管理（导入 / 导出 / 删除）。
     * 导出位置用内嵌的文件浏览视图选择，避免依赖系统文件选择器。
     */
    /**
     * 设置面板：通用设置（主题 / 语言）与数据管理（导入 / 导出 / 删除）。
     * 布局参照 DeepSeek 设置：顶部分类 tab、主题卡片、右侧动作按钮；
     * 导出位置用内嵌的文件浏览视图选择。
     */
    function SettingsDialog(props) {
      const t = props.t;
      const themeService = props.themeService;
      const localeService = props.localeService;
      const [tab, setTab] = useState('general');
      const [drag, setDrag] = useState(null);
      const dragRef = useRef(null);
      const tabIndex = tab === 'data' ? 1 : 0;
      const shiftPercent =
        -(tabIndex * 50) + (drag === null ? 0 : (drag.dx / Math.max(1, drag.width)) * 50);
      const [preference, setPreference] = useState(function () {
        return loadThemePreference() || readThemePreference(themeService);
      });
      const [locale, setLocale] = useState(function () {
        return readLocaleId(localeService);
      });
      const [menu, setMenu] = useState(null);
      const languageRef = useRef(null);
      const voiceRef = useRef(null);
      const [confirming, setConfirming] = useState(false);
      const [busy, setBusy] = useState(false);
      const [status, setStatus] = useState(null);
      const [view, setView] = useState('main');
      const [listing, setListing] = useState(null);
      const [browseError, setBrowseError] = useState('');
      const fileRef = useRef(null);
      /** 「检查更新」的状态：null = 未检查，其余见 updateHint。 */
      const [updateState, setUpdateState] = useState(null);
      const [updateBusy, setUpdateBusy] = useState(false);
      /** 快捷目录由 Host 提供（桌面是 Downloads / Documents / 主目录，Android 是 /sdcard）。 */
      const [quickDirs, setQuickDirs] = useState([]);
      useEffect(
        function () {
          let alive = true;
          fetch(`${API}/paths`, { headers: { accept: 'application/json' } })
            .then(function (response) {
              return response.ok ? response.json() : null;
            })
            .then(function (body) {
              if (!alive || body === null || !Array.isArray(body.dirs)) return;
              setQuickDirs(body.dirs);
            })
            .catch(function () {
              /* keep the built-in fallback */
            });
          return function () {
            alive = false;
          };
        },
        [],
      );

      useEffect(
        function () {
          const onKey = function (event) {
            if (event.key !== 'Escape') return;
            if (confirming) setConfirming(false);
            else if (view === 'browse') setView('main');
            else if (menu !== null) setMenu(null);
            else props.onClose();
          };
          document.addEventListener('keydown', onKey);
          return function () {
            document.removeEventListener('keydown', onKey);
          };
        },
        [confirming, view, props.onClose],
      );

      const chooseTheme = function (id) {
        setPreference(id);
        saveThemePreference(id);
        if (id === 'system') {
          applySystemTheme(themeService);
          return;
        }
        if (!themeService) return;
        try {
          themeService.setTheme(id);
        } catch (error) {
          /* an unregistered id keeps the previous preference */
        }
      };

      /** Anchor the menu to its select button so it unfolds from there (iOS style). */
      const openMenu = function (kind) {
        const node = kind === 'voice' ? voiceRef.current : languageRef.current;
        if (!node) {
          setMenu({ kind: kind, right: 24, top: 200, bottom: 200, width: 132, openUp: false });
          return;
        }
        const rect = node.getBoundingClientRect();
        const openUp = window.innerHeight - rect.bottom < 220;
        setMenu({
          kind: kind,
          right: Math.max(12, window.innerWidth - rect.right),
          top: rect.bottom + 6,
          bottom: window.innerHeight - rect.top + 6,
          width: Math.max(132, rect.width),
          openUp: openUp,
        });
      };

      const toggleMenu = function (kind) {
        if (menu !== null && menu.kind === kind) {
          setMenu(null);
          return;
        }
        openMenu(kind);
      };

      const chooseVoice = function (id) {
        props.onVoiceChange(id);
        setMenu(null);
      };

      const chooseLocale = function (id) {
        setLocale(id);
        setMenu(null);
        if (!localeService) return;
        try {
          localeService.setLocale(id);
        } catch (error) {
          /* an unknown locale keeps the previous preference */
        }
      };

      const openBrowser = async function (path) {
        setBrowseError('');
        setView('browse');
        setBusy(true);
        try {
          const result = await props.onListDirectory(path);
          setListing(result);
        } catch (error) {
          setListing(null);
          setBrowseError(t('settings.browseFailed'));
        } finally {
          setBusy(false);
        }
      };

      const runExport = async function () {
        if (busy) return;
        setBusy(true);
        setStatus(null);
        try {
          const result = await props.onExport(props.exportDir);
          setStatus(
            result && result.ok
              ? { kind: 'ok', text: result.text }
              : { kind: 'error', text: (result && result.text) || t('toast.exportFailed') },
          );
        } finally {
          setBusy(false);
        }
      };

      const runExportOfficial = async function () {
        if (busy) return;
        setBusy(true);
        setStatus(null);
        try {
          const result = await props.onExportOfficial();
          setStatus(
            result && result.ok
              ? { kind: 'ok', text: result.text }
              : { kind: 'error', text: (result && result.text) || t('toast.exportFailed') },
          );
        } finally {
          setBusy(false);
        }
      };

      const pickImport = function (files) {
        const file = files && files[0];
        if (!file) return;
        setBusy(true);
        setStatus(null);
        Promise.resolve(props.onImport(file))
          .then(function (result) {
            if (result && result.ok) setStatus({ kind: 'ok', text: result.text });
            else setStatus({ kind: 'error', text: (result && result.text) || t('toast.importFailed') });
          })
          .finally(function () {
            setBusy(false);
          });
      };

      const themes = [
        ['light', t('theme.light'), 'sun'],
        ['dark', t('theme.dark'), 'moon'],
        ['system', t('theme.system'), 'monitor'],
      ];
      const locales = [
        ['zh', t('language.zh')],
        ['en', t('language.en')],
      ];
      const quickLabels = {
        downloads: t('settings.quickDownloads'),
        documents: t('settings.quickDocuments'),
        home: t('settings.quickHome'),
        androidDownload: 'Download',
      };
      const quick =
        quickDirs.length > 0
          ? quickDirs.map(function (entry) {
              return [entry.path, quickLabels[entry.id] || entry.id];
            })
          : [
              ['/sdcard/Download', 'Download'],
              ['/sdcard/Documents', 'Documents'],
              ['/sdcard', t('settings.storageInternal')],
            ];
      const currentLocale = locale === 'en' ? t('language.en') : t('language.zh');

      const tabButton = function (id, label, icon) {
        const active = tab === id;
        return h(
          'button',
          {
            key: id,
            type: 'button',
            role: 'tab',
            'aria-selected': active ? 'true' : 'false',
            className: 'cd-tab' + (active ? ' cd-tab-on' : ''),
            onClick: function () {
              setTab(id);
              setMenu(null);
              setStatus(null);
            },
          },
          h(Icon, { name: icon, size: 17 }),
          h('span', null, label),
        );
      };

      /** Horizontal swipe between the two panes, mirroring the tab buttons. */
      const onTouchStart = function (event) {
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        dragRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          dx: 0,
          mode: null,
          width: event.currentTarget.clientWidth || 320,
        };
      };

      const onTouchMove = function (event) {
        const start = dragRef.current;
        const touch = event.touches && event.touches[0];
        if (!start || !touch) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (start.mode === null) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          start.mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }
        if (start.mode !== 'x') return;
        const atStart = tabIndex === 0 && dx > 0;
        const atEnd = tabIndex === 1 && dx < 0;
        start.dx = atStart || atEnd ? dx / 3 : dx;
        setDrag({ dx: start.dx, width: start.width });
      };

      const onTouchEnd = function () {
        const start = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (!start || start.mode !== 'x') return;
        const threshold = Math.min(96, start.width * 0.22);
        if (start.dx <= -threshold && tabIndex === 0) {
          setMenu(null);
          setStatus(null);
          setTab('data');
        } else if (start.dx >= threshold && tabIndex === 1) {
          setMenu(null);
          setStatus(null);
          setTab('general');
        }
      };

      const updateHint = function () {
        if (updateState === null) return t('update.current').replace('{version}', PLUGIN_VERSION);
        if (updateState.kind === 'checking') return t('update.checking');
        if (updateState.kind === 'latest') return t('update.latest').replace('{version}', updateState.version);
        if (updateState.kind === 'available') return t('update.available').replace('{version}', updateState.version);
        return t('update.failed');
      };

      /** 页脚那一行里显示的短标签。 */
      const updateLabel = function () {
        if (updateState === null) return t('update.check');
        if (updateState.kind === 'checking') return t('update.checkingShort');
        if (updateState.kind === 'latest') return t('update.latestShort');
        if (updateState.kind === 'available') return t('update.availableShort').replace('{version}', updateState.version);
        return t('update.failedShort');
      };

      /** 手动检查 GitHub 最新 Release；发现新版本后按钮变成「查看」。 */
      const checkUpdate = async function () {
        if (updateBusy) return;
        if (updateState !== null && updateState.kind === 'available') {
          if (updateState.url !== '') window.open(updateState.url, '_blank', 'noreferrer');
          return;
        }
        setUpdateBusy(true);
        setUpdateState({ kind: 'checking' });
        try {
          const response = await fetch(`${API}/update`, { headers: { accept: 'application/json' } });
          const body = await response.json();
          if (!response.ok || !body || body.ok !== true || typeof body.version !== 'string') {
            setUpdateState({ kind: 'failed' });
          } else if (compareVersions(body.version, PLUGIN_VERSION) > 0) {
            setUpdateState({
              kind: 'available',
              version: body.version,
              url: typeof body.url === 'string' ? body.url : '',
            });
          } else {
            setUpdateState({ kind: 'latest', version: body.version });
          }
        } catch (error) {
          setUpdateState({ kind: 'failed' });
        } finally {
          setUpdateBusy(false);
        }
      };

      const renderGeneral = function () {
        return h(
          'div',
          { className: 'cd-pane' },
          h('div', { className: 'cd-pane-title' }, t('settings.theme')),
          h(
            'div',
            { className: 'cd-theme-grid' },
            themes.map(function (option) {
              const active = preference === option[0];
              return h(
                'button',
                {
                  key: option[0],
                  type: 'button',
                  className:
                    'cd-theme-card' +
                    (option[0] === 'system' ? ' cd-theme-card-wide' : '') +
                    (active ? ' cd-theme-card-on' : ''),
                  'aria-pressed': active ? 'true' : 'false',
                  onClick: function () {
                    chooseTheme(option[0]);
                  },
                },
                h(Icon, { name: option[2], size: 22 }),
                h('span', { className: 'cd-theme-label' }, option[1]),
              );
            }),
          ),
          h(
            'div',
            { className: 'cd-row-list' },
            h(
              'div',
              { className: 'cd-row' },
              h('span', { className: 'cd-row-title' }, t('settings.fontSize')),
              h(
                'div',
                { className: 'cd-choices', role: 'group', 'aria-label': t('settings.fontSize') },
                FONT_IDS.map(function (id) {
                  const active = props.fontSize === id;
                  return h(
                    'button',
                    {
                      key: id,
                      type: 'button',
                      className: 'cd-choice' + (active ? ' cd-choice-on' : ''),
                      'aria-pressed': active ? 'true' : 'false',
                      onClick: function () {
                        if (props.onFontSizeChange) props.onFontSizeChange(id);
                      },
                    },
                    t('settings.font' + id.charAt(0).toUpperCase() + id.slice(1)),
                  );
                }),
              ),
            ),
            h(
              'div',
              { className: 'cd-row' },
              h('span', { className: 'cd-row-title' }, t('settings.language')),
              h(
                'button',
                {
                  ref: languageRef,
                  type: 'button',
                  className: 'cd-select',
                  'aria-haspopup': 'listbox',
                  'aria-expanded': menu !== null && menu.kind === 'language' ? 'true' : 'false',
                  onClick: function () {
                    toggleMenu('language');
                  },
                },
                h('span', null, currentLocale),
                h(Icon, { name: 'chevronDown', size: 15 }),
              ),
            ),
            h(
              'div',
              { className: 'cd-row' },
              h('span', { className: 'cd-row-title' }, t('settings.ttsVoice')),
              h(
                'button',
                {
                  ref: voiceRef,
                  type: 'button',
                  className: 'cd-select',
                  'aria-haspopup': 'listbox',
                  'aria-expanded': menu !== null && menu.kind === 'voice' ? 'true' : 'false',
                  onClick: function () {
                    toggleMenu('voice');
                  },
                },
                h('span', null, t('voice.' + (isVoiceId(props.voice) ? props.voice : 'stella'))),
                h(Icon, { name: 'chevronDown', size: 15 }),
              ),
            ),
          ),
          h('p', { className: 'cd-hint' }, t('settings.languageHint')),
        );
      };

      const renderData = function () {
        const rows = [
          {
            key: 'import',
            title: t('settings.import'),
            hint: t('settings.importHint'),
            action: t('settings.upload'),
            onClick: function () {
              if (fileRef.current) fileRef.current.click();
            },
          },
          {
            key: 'export',
            title: t('settings.export'),
            hint:
              props.exportDir === ''
                ? t('settings.locationDefault')
                : shortPath(props.exportDir),
            action: t('settings.download'),
            disabled: busy || props.threadCount === 0,
            onClick: runExport,
          },
          {
            key: 'exportOfficial',
            title: t('settings.exportOfficial'),
            hint: t('settings.exportOfficialHint'),
            action: t('settings.download'),
            disabled: busy || props.threadCount === 0,
            onClick: runExportOfficial,
          },
          {
            key: 'location',
            title: t('settings.location'),
            hint: t('settings.locationHint'),
            action: t('settings.change'),
            disabled: busy,
            onClick: function () {
              openBrowser(props.exportDir);
            },
          },
          {
            key: 'delete',
            title: t('settings.deleteAll'),
            hint: t('settings.deleteAllHint'),
            action: t('settings.delete'),
            danger: true,
            disabled: props.threadCount === 0,
            onClick: function () {
              setConfirming(true);
            },
          },
        ];
        return h(
          'div',
          { className: 'cd-pane' },
          h(
            'div',
            { className: 'cd-row-list' },
            rows.map(function (row) {
              return h(
                'div',
                { key: row.key, className: 'cd-row' },
                h(
                  'div',
                  { className: 'cd-row-main' },
                  h('span', { className: 'cd-row-title' }, row.title),
                  h('span', { className: 'cd-row-hint' }, row.hint),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'cd-pill-btn' + (row.danger ? ' cd-pill-btn-danger' : ''),
                    disabled: row.disabled === true,
                    onClick: row.onClick,
                  },
                  row.action,
                ),
              );
            }),
          ),
          h('input', {
            ref: fileRef,
            type: 'file',
            accept: '.json,.zip,application/json,application/zip',
            className: 'cd-file-input',
            'aria-hidden': 'true',
            tabIndex: -1,
            onChange: function (event) {
              pickImport(event.target.files);
              event.target.value = '';
            },
          }),
          status === null
            ? null
            : h('p', { className: 'cd-status' + (status.kind === 'error' ? ' cd-status-error' : '') }, status.text),
        );
      };

      const renderBrowse = function () {
        const crumbs = listing ? listing.crumbs : [];
        const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].path : '';
        return h(
          'div',
          { className: 'cd-browse' },
          h(
            'div',
            { className: 'cd-browse-head' },
            h(
              'button',
              {
                type: 'button',
                className: 'cd-iconbtn cd-iconbtn-sm',
                title: t('settings.browseBack'),
                'aria-label': t('settings.browseBack'),
                onClick: function () {
                  setView('main');
                },
              },
              h(Icon, { name: 'chevronLeft', size: 16 }),
            ),
            h(
              'span',
              {
                className: 'cd-browse-path',
                title: listing ? listing.path : props.exportDir === '' ? t('settings.locationDefault') : props.exportDir,
              },
              listing
                ? shortPath(listing.path)
                : props.exportDir === ''
                  ? t('settings.locationDefault')
                  : shortPath(props.exportDir),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'cd-textbtn',
                disabled: parent === '' || busy,
                onClick: function () {
                  if (parent !== '') openBrowser(parent);
                },
              },
              t('settings.browseUp'),
            ),
          ),
          h(
            'div',
            { className: 'cd-browse-quick' },
            quick.map(function (entry) {
              return h(
                'button',
                {
                  key: entry[0],
                  type: 'button',
                  className: 'cd-choice',
                  disabled: busy,
                  onClick: function () {
                    openBrowser(entry[0]);
                  },
                },
                entry[1],
              );
            }),
          ),
          h(
            'div',
            { className: 'cd-browse-list' },
            browseError !== ''
              ? h('p', { className: 'cd-status cd-status-error' }, browseError)
              : listing === null
                ? h('p', { className: 'cd-status' }, t('settings.browsing'))
                : listing.entries.length === 0
                  ? h('p', { className: 'cd-status' }, t('settings.browseEmpty'))
                  : listing.entries.map(function (entry) {
                      return h(
                        'button',
                        {
                          key: entry.path,
                          type: 'button',
                          className: 'cd-folder',
                          disabled: busy,
                          onClick: function () {
                            openBrowser(entry.path);
                          },
                        },
                        h(Icon, { name: 'folder', size: 16 }),
                        h('span', { className: 'cd-folder-name' }, entry.name),
                      );
                    }),
          ),
          h(
            'div',
            { className: 'cd-browse-foot' },
            h(
              'button',
              {
                type: 'button',
                className: 'cd-btn cd-btn-primary',
                disabled: busy || listing === null,
                onClick: function () {
                  const chosen = listing ? listing.path : props.exportDir;
                  props.onChooseDir(chosen);
                  setStatus({ kind: 'ok', text: t('settings.locationSet').replace('{path}', shortPath(chosen)) });
                  setView('main');
                },
              },
              t('settings.browseHere'),
            ),
          ),
        );
      };

      return h(
        'div',
        { className: 'cd-modal' },
        h('div', { className: 'cd-modal-mask', onClick: props.onClose }),
        h(
          'section',
          { className: 'cd-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('settings.title') },
          h(
            'header',
            { className: 'cd-sheet-head' },
            h('h2', { className: 'cd-sheet-title' }, view === 'browse' ? t('settings.browse') : t('settings.title')),
            h(
              'button',
              {
                type: 'button',
                className: 'cd-iconbtn cd-iconbtn-sm',
                title: t('action.close'),
                'aria-label': t('action.close'),
                onClick: props.onClose,
              },
              h(Icon, { name: 'x', size: 16 }),
            ),
          ),
          view === 'browse'
            ? renderBrowse()
            : h(
                'div',
                { className: 'cd-sheet-body' },
                h(
                  'div',
                  { className: 'cd-tabs', role: 'tablist' },
                  tabButton('general', t('settings.general'), 'gear'),
                  tabButton('data', t('settings.data'), 'database'),
                ),
                h(
                  'div',
                  {
                    className: 'cd-panes',
                    onTouchStart: onTouchStart,
                    onTouchMove: onTouchMove,
                    onTouchEnd: onTouchEnd,
                    onTouchCancel: onTouchEnd,
                  },
                  h(
                    'div',
                    {
                      className: 'cd-track',
                      style: {
                        transform: 'translateX(' + shiftPercent + '%)',
                        transition: drag === null ? undefined : 'none',
                      },
                    },
                    h('div', { className: 'cd-pane-slot' }, renderGeneral()),
                    h('div', { className: 'cd-pane-slot' }, renderData()),
                  ),
                ),
              ),
          view === 'browse'
            ? null
            : h(
                'footer',
                { className: 'cd-settings-foot' },
                h('span', null, 'v' + PLUGIN_VERSION),
                h('span', { 'aria-hidden': 'true' }, '·'),
                h(
                  'a',
                  {
                    className: 'cd-settings-repo',
                    href: REPO_URL,
                    target: '_blank',
                    rel: 'noreferrer',
                  },
                  'GitHub',
                ),
                h('span', { 'aria-hidden': 'true' }, '·'),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'cd-settings-update',
                    title: updateHint(),
                    disabled: updateBusy,
                    onClick: checkUpdate,
                  },
                  updateLabel(),
                ),
              ),
          menu !== null
            ? h(
                'div',
                {
                  className: 'cd-menu-layer',
                  onClick: function () {
                    setMenu(null);
                  },
                },
                h(
                  'div',
                  {
                    className: 'cd-select-menu' + (menu.openUp ? ' cd-select-menu-up' : ''),
                    role: 'listbox',
                    style: Object.assign(
                      {
                        right: menu.right + 'px',
                        minWidth: menu.width + 'px',
                      },
                      menu.openUp ? { bottom: menu.bottom + 'px' } : { top: menu.top + 'px' },
                    ),
                    onClick: function (event) {
                      event.stopPropagation();
                    },
                  },
                  menu.kind === 'voice'
                    ? VOICE_IDS.map(function (id) {
                        return [id, t('voice.' + id)];
                      }).map(function (option) {
                        const active = props.voice === option[0];
                        return h(
                          'button',
                          {
                            key: option[0],
                            type: 'button',
                            role: 'option',
                            'aria-selected': active ? 'true' : 'false',
                            className: 'cd-select-item' + (active ? ' cd-select-item-on' : ''),
                            onClick: function () {
                              chooseVoice(option[0]);
                            },
                          },
                          h('span', null, option[1]),
                          active ? h(Icon, { name: 'check', size: 14 }) : null,
                        );
                      })
                    : locales.map(function (option) {
                        const active = locale === option[0];
                        return h(
                          'button',
                          {
                            key: option[0],
                            type: 'button',
                            role: 'option',
                            'aria-selected': active ? 'true' : 'false',
                            className: 'cd-select-item' + (active ? ' cd-select-item-on' : ''),
                            onClick: function () {
                              chooseLocale(option[0]);
                            },
                          },
                          h('span', null, option[1]),
                          active ? h(Icon, { name: 'check', size: 14 }) : null,
                        );
                      }),
                ),
              )
            : null,
          confirming
            ? h(
                'div',
                { className: 'cd-modal cd-modal-confirm' },
                h('div', {
                  className: 'cd-modal-mask',
                  onClick: function () {
                    setConfirming(false);
                  },
                }),
                h(
                  'section',
                  {
                    className: 'cd-confirm',
                    role: 'alertdialog',
                    'aria-modal': 'true',
                    'aria-label': t('settings.deleteAll'),
                  },
                  h('h3', { className: 'cd-confirm-title' }, t('settings.deleteAllAsk')),
                  h('p', { className: 'cd-confirm-text' }, t('settings.deleteAllWarn')),
                  h(
                    'div',
                    { className: 'cd-confirm-actions' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'cd-btn',
                        onClick: function () {
                          setConfirming(false);
                        },
                      },
                      t('action.cancel'),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'cd-btn cd-btn-danger',
                        onClick: function () {
                          setConfirming(false);
                          props.onDeleteAll();
                          props.onClose();
                        },
                      },
                      t('action.confirmDelete'),
                    ),
                  ),
                ),
              )
            : null,
        ),
      );
    }

    /* ----------------------------------------------------------------- sider */

    function Sider(props) {
      const t = props.t;
      const [query, setQuery] = useState('');
      const needle = query.trim().toLowerCase();
      /** 搜索命中标题或任意一条消息的正文；空查询直接返回全部。 */
      const visibleThreads = useMemo(
        function () {
          if (needle === '') return props.threads;
          return props.threads.filter(function (thread) {
            if (thread.title.toLowerCase().indexOf(needle) >= 0) return true;
            return thread.messages.some(function (message) {
              return typeof message.text === 'string' && message.text.toLowerCase().indexOf(needle) >= 0;
            });
          });
        },
        [props.threads, needle],
      );
      const groups = useMemo(
        function () {
          return groupThreads(visibleThreads, t);
        },
        [visibleThreads, t],
      );
      const [menu, setMenu] = useState(null);
      const menuRef = useRef(null);
      const triggerRef = useRef(null);
      const selecting = props.selecting === true;
      const selectedIds = Array.isArray(props.selected) ? props.selected : [];
      const isChecked = function (id) {
        return selectedIds.indexOf(id) >= 0;
      };
      const allPinned =
        selectedIds.length > 0 &&
        selectedIds.every(function (id) {
          const thread = props.threads.find(function (item) {
            return item.id === id;
          });
          return thread !== undefined && typeof thread.pinnedAt === 'number';
        });
      /** 「全选」作用于当前筛选结果，而不是全部会话。 */
      const visibleIds = visibleThreads.map(function (thread) {
        return thread.id;
      });
      const allVisibleSelected =
        visibleIds.length > 0 &&
        visibleIds.every(function (id) {
          return isChecked(id);
        });
      const menuItemRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];
      const menuFocusRef = useRef(0);

      /** 菜单在页面根节点内绝对定位，因此能越过列表的滚动裁剪；点外部、Esc、缩放和滚动都会收起。 */
      useEffect(
        function () {
          if (menu === null) return undefined;
          const onPointer = function (event) {
            const target = event.target;
            // 触发按钮自己处理开合，pointerdown 不能抢先把它关掉。
            if (target && target.closest && target.closest('.cd-item-menu')) return;
            if (menuRef.current && menuRef.current.contains(target)) return;
            setMenu(null);
          };
          const onKey = function (event) {
            if (event.key !== 'Escape') return;
            setMenu(null);
            if (triggerRef.current) triggerRef.current.focus();
          };
          const onResize = function () {
            setMenu(null);
          };
          document.addEventListener('pointerdown', onPointer, true);
          document.addEventListener('keydown', onKey);
          window.addEventListener('resize', onResize);
          return function () {
            document.removeEventListener('pointerdown', onPointer, true);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onResize);
          };
        },
        [menu],
      );

      /** 菜单打开后把焦点放到第一项，之后由方向键在项间移动。 */
      useEffect(
        function () {
          if (menu === null) return;
          menuFocusRef.current = 0;
          const first = menuItemRefs[0].current;
          if (first && first.focus) first.focus();
        },
        [menu],
      );

      const onMenuKeyDown = function (event) {
        const items = menuItemRefs
          .map(function (ref) {
            return ref.current;
          })
          .filter(Boolean);
        if (items.length === 0) return;
        let next = -1;
        if (event.key === 'ArrowDown') next = (menuFocusRef.current + 1) % items.length;
        else if (event.key === 'ArrowUp') next = (menuFocusRef.current - 1 + items.length) % items.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = items.length - 1;
        if (next < 0) return;
        event.preventDefault();
        menuFocusRef.current = next;
        if (items[next].focus) items[next].focus();
      };

      const openMenu = function (event, thread) {
        event.preventDefault();
        event.stopPropagation();
        if (menu !== null && menu.id === thread.id) {
          setMenu(null);
          return;
        }
        const button = event.currentTarget;
        triggerRef.current = button;
        const rect = button.getBoundingClientRect();
        const page = button.closest ? button.closest('.cd-page') : null;
        const base = page
          ? page.getBoundingClientRect()
          : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const width = 176;
        const height = 236;
        const up = base.top + base.height - rect.bottom < height + 8;
        const left = Math.max(8, Math.min(rect.right - base.left - width, base.width - width - 8));
        const rawTop = up ? rect.top - base.top - height - 6 : rect.bottom - base.top + 6;
        setMenu({ id: thread.id, thread: thread, left: left, top: Math.max(8, rawTop), up: up });
      };

      const run = function (action) {
        const current = menu;
        setMenu(null);
        if (current !== null && action) action(current.thread);
      };

      const className = 'cd-sider' + (props.mobile ? ' cd-sider-mobile' : '');
      return h(
        'aside',
        { className: className, 'aria-label': t('panel.label') },
        h(
          'div',
          { className: 'cd-sider-top' },
          h(
            'div',
            { className: 'cd-brand' },
            h(Logo, { size: 24 }),
            h('span', { className: 'cd-appname' }, t('app.name')),
          ),
          props.mobile
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'cd-iconbtn cd-iconbtn-sm',
                  title: t('action.expand'),
                  'aria-label': t('action.expand'),
                  onClick: function () {
                    props.onCloseDrawer();
                  },
                },
                h(Icon, { name: 'x', size: 16 }),
              )
            : h(
                'button',
                {
                  type: 'button',
                  className: 'cd-iconbtn cd-iconbtn-sm',
                  title: t('action.collapse'),
                  'aria-label': t('action.collapse'),
                  onClick: props.onCollapse,
                },
                h(Icon, { name: 'sidebar', size: 18 }),
              ),
        ),
        selecting
          ? h(
              'div',
              { className: 'cd-multibar' },
              h(
                'div',
                { className: 'cd-multibar-top' },
                h(
                  'span',
                  { className: 'cd-multibar-count', 'aria-live': 'polite' },
                  t('select.count').replace('{count}', String(selectedIds.length)),
                ),
                h(
                  'div',
                  { className: 'cd-multibar-tools' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'cd-textbtn',
                      onClick: function () {
                        props.onSetSelection(allVisibleSelected ? [] : visibleIds.slice());
                      },
                    },
                    allVisibleSelected ? t('select.none') : t('select.all'),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'cd-textbtn', onClick: props.onExitSelect },
                    t('select.exit'),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'cd-multibar-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'cd-multibar-btn',
                    disabled: selectedIds.length === 0,
                    onClick: props.onBulkPin,
                  },
                  h(Icon, { name: allPinned ? 'pinOff' : 'pin', size: 15 }),
                  h('span', null, allPinned ? t('select.unpin') : t('select.pin')),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'cd-multibar-btn',
                    disabled: selectedIds.length === 0,
                    onClick: props.onBulkExport,
                  },
                  h(Icon, { name: 'download', size: 15 }),
                  h('span', null, t('select.export')),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'cd-multibar-btn cd-multibar-danger',
                    disabled: selectedIds.length === 0,
                    onClick: props.onBulkDelete,
                  },
                  h(Icon, { name: 'trash', size: 15 }),
                  h('span', null, t('select.delete')),
                ),
              ),
            )
          : h(
              'button',
              { type: 'button', className: 'cd-newchat', onClick: props.onNew },
              h('span', { className: 'cd-newchat-icon' }, h(Icon, { name: 'plus', size: 16 })),
              h('span', null, t('action.newChat')),
            ),
        h(
          'div',
          { className: 'cd-filter' },
          h(Icon, { name: 'search', size: 15 }),
          h('input', {
            className: 'cd-filter-input',
            type: 'search',
            value: query,
            placeholder: t('search.placeholder'),
            'aria-label': t('search.placeholder'),
            onChange: function (event) {
              setQuery(event.target.value);
            },
            onKeyDown: function (event) {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (visibleThreads.length > 0) props.onSelect(visibleThreads[0].id);
                return;
              }
              if (event.key !== 'Escape') return;
              event.stopPropagation();
              if (query !== '') setQuery('');
            },
          }),
          query === ''
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  className: 'cd-filter-clear',
                  title: t('search.clear'),
                  'aria-label': t('search.clear'),
                  onClick: function () {
                    setQuery('');
                  },
                },
                h(Icon, { name: 'x', size: 13 }),
              ),
        ),
        h(
          'div',
          { className: 'cd-listwrap' },
          h(
            'div',
            {
              className: 'cd-list',
              onScroll: function () {
                if (menu !== null) setMenu(null);
              },
            },
            groups.length === 0
              ? h(
                  'div',
                  { className: 'cd-list-empty' },
                  needle === '' ? t('list.empty') : t('search.empty'),
                )
              : null,
            groups.map(function (group) {
              return h(
                'div',
                { key: group.key, className: 'cd-section' },
                h('div', { className: 'cd-section-header' }, group.label),
                group.items.map(function (thread) {
                  const active = thread.id === props.activeId;
                  const checked = isChecked(thread.id);
                  return h(
                    'div',
                    {
                      key: thread.id,
                      role: 'button',
                      tabIndex: 0,
                      title: thread.title,
                      'aria-pressed': selecting ? (checked ? 'true' : 'false') : undefined,
                      className:
                        'cd-item' +
                        (active ? ' cd-item-active' : '') +
                        (selecting ? ' cd-item-selecting' : '') +
                        (selecting && checked ? ' cd-item-checked' : ''),
                      onClick: function () {
                        if (selecting) props.onToggleSelect(thread.id);
                        else props.onSelect(thread.id);
                      },
                      onKeyDown: function (event) {
                        if (!selecting && event.key === 'F2') {
                          event.preventDefault();
                          props.onRename(thread);
                          return;
                        }
                        if (!selecting && event.key === 'Delete') {
                          event.preventDefault();
                          props.onDelete(thread);
                          return;
                        }
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        if (selecting) props.onToggleSelect(thread.id);
                        else props.onSelect(thread.id);
                      },
                    },
                    selecting
                      ? h(
                          'span',
                          { className: 'cd-check' + (checked ? ' cd-check-on' : ''), 'aria-hidden': 'true' },
                          checked ? h(Icon, { name: 'check', size: 12, strokeWidth: 2.8 }) : null,
                        )
                      : null,
                    h('span', { className: 'cd-item-title' }, thread.title),
                    selecting
                      ? null
                      : h(
                          'button',
                          {
                            type: 'button',
                            className: 'cd-item-menu',
                            title: t('menu.open'),
                            'aria-label': t('menu.open'),
                            'aria-haspopup': 'menu',
                            'aria-expanded': menu !== null && menu.id === thread.id ? 'true' : 'false',
                            onClick: function (event) {
                              openMenu(event, thread);
                            },
                          },
                          h(Icon, { name: 'more', size: 16 }),
                        ),
                  );
                }),
              );
            }),
          ),
        ),
        h(
          'div',
          { className: 'cd-sider-bottom' },
          h(
            'button',
            { type: 'button', className: 'cd-settings', onClick: props.onOpenSettings },
            h('span', { className: 'cd-settings-icon' }, h(Icon, { name: 'gear', size: 18 })),
            h('span', { className: 'cd-settings-label' }, t('action.settings')),
          ),
        ),
        menu === null
          ? null
          : h(
              'div',
              {
                ref: menuRef,
                className: 'cd-session-menu' + (menu.up ? ' cd-session-menu-up' : ''),
                role: 'menu',
                'aria-label': t('menu.open'),
                style: { top: menu.top + 'px', left: menu.left + 'px' },
                onKeyDown: onMenuKeyDown,
              },
              h(
                'button',
                {
                  type: 'button',
                  role: 'menuitem',
                  ref: menuItemRefs[0],
                  className: 'cd-session-menu-item',
                  onClick: function () {
                    run(props.onRename);
                  },
                },
                h(Icon, { name: 'pencil', size: 16 }),
                h('span', null, t('menu.rename')),
              ),
              h(
                'button',
                {
                  type: 'button',
                  role: 'menuitem',
                  ref: menuItemRefs[1],
                  className: 'cd-session-menu-item',
                  onClick: function () {
                    run(props.onTogglePin);
                  },
                },
                h(Icon, {
                  name: typeof menu.thread.pinnedAt === 'number' ? 'pinOff' : 'pin',
                  size: 16,
                }),
                h(
                  'span',
                  null,
                  typeof menu.thread.pinnedAt === 'number' ? t('menu.unpin') : t('menu.pin'),
                ),
              ),
              h(
                'button',
                {
                  type: 'button',
                  role: 'menuitem',
                  ref: menuItemRefs[2],
                  className: 'cd-session-menu-item',
                  onClick: function () {
                    run(props.onMulti);
                  },
                },
                h(Icon, { name: 'checkSquare', size: 16 }),
                h('span', null, t('menu.multi')),
              ),
              h(
                'button',
                {
                  type: 'button',
                  role: 'menuitem',
                  ref: menuItemRefs[3],
                  className: 'cd-session-menu-item',
                  onClick: function () {
                    run(props.onExportOne);
                  },
                },
                h(Icon, { name: 'download', size: 16 }),
                h('span', null, t('menu.exportJson')),
              ),
              h(
                'button',
                {
                  type: 'button',
                  role: 'menuitem',
                  ref: menuItemRefs[4],
                  className: 'cd-session-menu-item',
                  onClick: function () {
                    run(props.onExportMarkdown);
                  },
                },
                h(Icon, { name: 'file', size: 16 }),
                h('span', null, t('menu.exportMarkdown')),
              ),
              h('div', { className: 'cd-session-menu-sep', role: 'separator' }),
              h(
                'button',
                {
                  type: 'button',
                  role: 'menuitem',
                  ref: menuItemRefs[5],
                  className: 'cd-session-menu-item cd-session-menu-danger',
                  onClick: function () {
                    run(props.onDelete);
                  },
                },
                h(Icon, { name: 'trash', size: 16 }),
                h('span', null, t('menu.delete')),
              ),
            ),
      );
    }

    /** 重命名对话：草稿在挂载时取自当前标题，保存后立刻写回线程。 */
    function RenameDialog(props) {
      const t = props.t;
      const [draft, setDraft] = useState(props.initial || '');
      const inputRef = useRef(null);
      const cancelRef = useRef(null);
      const saveRef = useRef(null);
      const restoreRef = useRef(null);
      useEffect(
        function () {
          restoreRef.current = document.activeElement;
          const element = inputRef.current;
          if (element) {
            element.focus();
            if (element.select) element.select();
          }
          return function () {
            // 关闭后把焦点还给打开对话框的控件（键盘用户不会掉焦点）。
            const previous = restoreRef.current;
            if (previous && previous.focus) previous.focus();
          };
        },
        [],
      );
      const trimmed = draft.trim();
      const blocked = trimmed === '';
      const save = function () {
        if (blocked) return;
        props.onSave(trimmed);
      };
      /** 把 Tab / Shift+Tab 限制在对话框内，避免焦点跑到背后的页面上。 */
      const onDialogKeyDown = function (event) {
        if (event.key === 'Escape') {
          event.stopPropagation();
          props.onCancel();
          return;
        }
        if (event.key !== 'Tab') return;
        const fields = [inputRef.current, cancelRef.current, saveRef.current].filter(function (element) {
          return element !== null && element !== undefined;
        });
        if (fields.length === 0) return;
        const index = fields.indexOf(event.target);
        if (index < 0) return;
        event.preventDefault();
        const next = event.shiftKey ? (index - 1 + fields.length) % fields.length : (index + 1) % fields.length;
        if (fields[next].focus) fields[next].focus();
      };
      return h(
        'div',
        { className: 'cd-modal' },
        h('div', { className: 'cd-modal-mask', onClick: props.onCancel }),
        h(
          'section',
          {
            className: 'cd-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('rename.title'),
            onKeyDown: onDialogKeyDown,
          },
          h('h3', { className: 'cd-dialog-title' }, t('rename.title')),
          h('input', {
            ref: inputRef,
            className: 'cd-dialog-input',
            value: draft,
            maxLength: 60,
            placeholder: t('rename.field'),
            'aria-label': t('rename.field'),
            onChange: function (event) {
              setDraft(event.target.value);
            },
            onKeyDown: function (event) {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              save();
            },
          }),
          h(
            'div',
            { className: 'cd-dialog-actions' },
            h(
              'button',
              { ref: cancelRef, type: 'button', className: 'cd-btn', onClick: props.onCancel },
              t('action.cancel'),
            ),
            h(
              'button',
              {
                ref: saveRef,
                type: 'button',
                className: 'cd-btn cd-btn-primary',
                disabled: blocked,
                onClick: save,
              },
              t('rename.save'),
            ),
          ),
        ),
      );
    }

    /**
     * 编辑一条用户消息：保存后截断到该条并重新生成回答。
     * Ctrl/Cmd+Enter 保存，Esc 取消，Tab 限制在对话框内。
     */
    function EditDialog(props) {
      const t = props.t;
      const [draft, setDraft] = useState(props.initial || '');
      const areaRef = useRef(null);
      const cancelRef = useRef(null);
      const saveRef = useRef(null);
      const restoreRef = useRef(null);
      useEffect(
        function () {
          restoreRef.current = document.activeElement;
          const element = areaRef.current;
          if (element) {
            element.focus();
            if (element.setSelectionRange) element.setSelectionRange(element.value.length, element.value.length);
          }
          return function () {
            const previous = restoreRef.current;
            if (previous && previous.focus) previous.focus();
          };
        },
        [],
      );
      const trimmed = draft.trim();
      const blocked = trimmed === '';
      const save = function () {
        if (blocked) return;
        props.onSave(trimmed);
      };
      const onDialogKeyDown = function (event) {
        if (event.key === 'Escape') {
          event.stopPropagation();
          props.onCancel();
          return;
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          save();
          return;
        }
        if (event.key !== 'Tab') return;
        const fields = [areaRef.current, cancelRef.current, saveRef.current].filter(function (element) {
          return element !== null && element !== undefined;
        });
        if (fields.length === 0) return;
        const index = fields.indexOf(event.target);
        if (index < 0) return;
        event.preventDefault();
        const next = event.shiftKey ? (index - 1 + fields.length) % fields.length : (index + 1) % fields.length;
        if (fields[next].focus) fields[next].focus();
      };
      return h(
        'div',
        { className: 'cd-modal' },
        h('div', { className: 'cd-modal-mask', onClick: props.onCancel }),
        h(
          'section',
          {
            className: 'cd-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('edit.title'),
            onKeyDown: onDialogKeyDown,
          },
          h('h3', { className: 'cd-dialog-title' }, t('edit.title')),
          h('textarea', {
            ref: areaRef,
            className: 'cd-dialog-textarea',
            value: draft,
            'aria-label': t('edit.field'),
            placeholder: t('edit.field'),
            onChange: function (event) {
              setDraft(event.target.value);
            },
          }),
          h('p', { className: 'cd-dialog-hint' }, t('edit.hint')),
          h(
            'div',
            { className: 'cd-dialog-actions' },
            h(
              'button',
              { ref: cancelRef, type: 'button', className: 'cd-btn', onClick: props.onCancel },
              t('action.cancel'),
            ),
            h(
              'button',
              {
                ref: saveRef,
                type: 'button',
                className: 'cd-btn cd-btn-primary',
                disabled: blocked,
                onClick: save,
              },
              t('edit.submit'),
            ),
          ),
        ),
      );
    }

    /**
     * 删除确认：标题说明不可恢复，删除按钮为红色气泡 + 白字，
     * 取消按钮为灰白色 + 黑字并默认聚焦，所以回车等于取消。
     */
    function DeleteDialog(props) {
      const t = props.t;
      const count = props.count;
      const cancelRef = useRef(null);
      const dangerRef = useRef(null);
      const restoreRef = useRef(null);
      useEffect(
        function () {
          restoreRef.current = document.activeElement;
          if (cancelRef.current) cancelRef.current.focus();
          return function () {
            const previous = restoreRef.current;
            if (previous && previous.focus) previous.focus();
          };
        },
        [],
      );
      /** Esc 取消；Tab / Shift+Tab 只在两个按钮之间循环。 */
      const onDialogKeyDown = function (event) {
        if (event.key === 'Escape') {
          event.stopPropagation();
          props.onCancel();
          return;
        }
        if (event.key !== 'Tab') return;
        const fields = [cancelRef.current, dangerRef.current].filter(function (element) {
          return element !== null && element !== undefined;
        });
        if (fields.length === 0) return;
        const index = fields.indexOf(event.target);
        if (index < 0) return;
        event.preventDefault();
        const next = event.shiftKey ? (index - 1 + fields.length) % fields.length : (index + 1) % fields.length;
        if (fields[next].focus) fields[next].focus();
      };
      const title =
        count > 1 ? t('delete.titleMulti').replace('{count}', String(count)) : t('delete.title');
      const action =
        count > 1 ? t('delete.actionMulti').replace('{count}', String(count)) : t('delete.action');
      return h(
        'div',
        { className: 'cd-modal' },
        h('div', { className: 'cd-modal-mask', onClick: props.onCancel }),
        h(
          'section',
          {
            className: 'cd-confirm cd-delete-confirm',
            role: 'alertdialog',
            'aria-modal': 'true',
            'aria-label': title,
            onKeyDown: onDialogKeyDown,
          },
          h('h3', { className: 'cd-delete-title' }, title),
          h('p', { className: 'cd-delete-note' }, t('delete.undoNote')),
          h(
            'div',
            { className: 'cd-delete-actions' },
            h(
              'button',
              {
                ref: cancelRef,
                type: 'button',
                className: 'cd-confirm-pill cd-confirm-pill-cancel',
                onClick: props.onCancel,
              },
              t('action.cancel'),
            ),
            h(
              'button',
              {
                ref: dangerRef,
                type: 'button',
                className: 'cd-confirm-pill cd-confirm-pill-danger',
                onClick: props.onConfirm,
              },
              action,
            ),
          ),
        ),
      );
    }

    /* -------------------------------------------------------------- composer */

    function Composer(props) {
      const t = props.t;
      const textareaRef = props.textareaRef;
      const fileRef = useRef(null);

      useEffect(
        function () {
          const element = textareaRef.current;
          if (!element) return;
          element.style.height = 'auto';
          element.style.height = Math.min(element.scrollHeight, 336) + 'px';
        },
        [props.value, textareaRef],
      );

      const submit = function () {
        props.onSend();
      };

      return h(
        'div',
        {
          className: 'cd-composer ' + (props.home ? 'cd-composer-home' : 'cd-composer-session'),
          onClick: function (event) {
            if (event.target === event.currentTarget && textareaRef.current) textareaRef.current.focus();
          },
        },
        props.attachments.length > 0
          ? h(
              'div',
              { className: 'cd-files' },
              props.attachments.map(function (file) {
                if (file.kind === 'image') {
                  return h(ImageChip, {
                    key: file.id,
                    imageId: file.imageId,
                    name: file.name,
                    removeLabel: t('action.delete'),
                    onRemove: function () {
                      props.onRemoveFile(file.id);
                    },
                  });
                }
                return h(
                  'span',
                  { key: file.id, className: 'cd-chip', title: file.name },
                  h(Icon, { name: 'file', size: 13 }),
                  h('span', { className: 'cd-chip-name' }, file.name),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'cd-chip-x',
                      title: t('action.delete'),
                      'aria-label': t('action.delete'),
                      onClick: function () {
                        props.onRemoveFile(file.id);
                      },
                    },
                    h(Icon, { name: 'x', size: 11 }),
                  ),
                );
              }),
            )
          : null,
        h(
          'div',
          { className: 'cd-ta-wrap' },
          h('textarea', {
            ref: textareaRef,
            className: 'cd-ta',
            rows: 2,
            value: props.value,
            placeholder: t('placeholder'),
            'aria-label': t('placeholder'),
            onChange: function (event) {
              props.onChange(event.target.value);
            },
            onKeyDown: function (event) {
              if (event.key !== 'Enter' || event.shiftKey) return;
              if (event.nativeEvent && event.nativeEvent.isComposing) return;
              event.preventDefault();
              submit();
            },
          }),
        ),
        h(
          'div',
          { className: 'cd-fn-row' },
          h(
            'div',
            { className: 'cd-toggles' },
            h(
              'button',
              {
                type: 'button',
                className: 'cd-toggle' + (props.thinking ? ' cd-toggle-on' : ''),
                title: t('toggle.thinking'),
                'aria-label': t('toggle.thinking'),
                'aria-pressed': props.thinking ? 'true' : 'false',
                onClick: function () {
                  props.onToggleThinking();
                },
              },
              h(Icon, { name: 'sparkle', size: 16 }),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'cd-toggle' + (props.search ? ' cd-toggle-on' : ''),
                title: t('toggle.search'),
                'aria-label': t('toggle.search'),
                'aria-pressed': props.search ? 'true' : 'false',
                onClick: function () {
                  props.onToggleSearch();
                },
              },
              h(Icon, { name: 'globe', size: 16 }),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'cd-model-chip',
                title: t('model.pick'),
                'aria-label': t('model.pick'),
                onClick: function () {
                  props.onOpenModel();
                },
              },
              h('span', { className: 'cd-model-chip-name' }, props.modelLabel),
              h(Icon, { name: 'chevronDown', size: 14 }),
            ),
          ),
          h(
            'div',
            { className: 'cd-right' },
            props.contextOccupancy
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'cd-meter',
                    'aria-haspopup': 'dialog',
                    'aria-label': t('usage.context')
                      .replace('{percent}', String(props.contextOccupancy.percent))
                      .replace('{used}', formatTokenCount(props.contextOccupancy.used))
                      .replace('{window}', formatTokenCount(props.contextOccupancy.window)),
                    title: t('usage.context')
                      .replace('{percent}', String(props.contextOccupancy.percent))
                      .replace('{used}', formatTokenCount(props.contextOccupancy.used))
                      .replace('{window}', formatTokenCount(props.contextOccupancy.window)),
                    onClick: function () {
                      props.onOpenUsage('context');
                    },
                  },
                  h(
                    'svg',
                    { viewBox: '0 0 14 14', width: 14, height: 14, 'aria-hidden': 'true' },
                    h('circle', {
                      cx: 7,
                      cy: 7,
                      r: 5.5,
                      fill: 'none',
                      stroke: 'currentColor',
                      strokeWidth: 2,
                      opacity: 0.25,
                    }),
                    h('circle', {
                      cx: 7,
                      cy: 7,
                      r: 5.5,
                      fill: 'none',
                      stroke: 'currentColor',
                      strokeWidth: 2,
                      strokeLinecap: 'round',
                      strokeDasharray:
                        (2 * Math.PI * 5.5 * props.contextOccupancy.percent) / 100 + ' ' + 2 * Math.PI * 5.5,
                      transform: 'rotate(-90 7 7)',
                    }),
                  ),
                  h('span', null, props.contextOccupancy.percent + '%'),
                )
              : null,
            h(
              'button',
              {
                type: 'button',
                className: 'cd-iconbtn',
                title: t('action.attach'),
                'aria-label': t('action.attach'),
                onClick: function () {
                  if (fileRef.current) fileRef.current.click();
                },
              },
              h(Icon, { name: 'paperclip', size: 18 }),
            ),
            h('input', {
              ref: fileRef,
              type: 'file',
              multiple: true,
              accept: 'image/*,.txt,.md,.json,.csv,.log,.js,.ts,.py,.html,.css,.yml,.yaml',
              className: 'cd-file-input',
              'aria-hidden': 'true',
              tabIndex: -1,
              onChange: function (event) {
                const files = event.target.files;
                if (files && files.length > 0) props.onPickFiles(files);
                event.target.value = '';
              },
            }),
            h(
              'button',
              {
                type: 'button',
                className: 'cd-iconbtn' + (props.recording ? ' cd-mic-live' : ''),
                title: props.recording ? t('action.voiceStop') : t('action.voice'),
                'aria-label': props.recording ? t('action.voiceStop') : t('action.voice'),
                'aria-pressed': props.recording ? 'true' : 'false',
                disabled: props.transcribing,
                onClick: function () {
                  props.onVoice();
                },
              },
              h(Icon, { name: props.recording ? 'stop' : 'mic', size: 18 }),
            ),
            props.pending
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'cd-send',
                    title: t('action.stop'),
                    'aria-label': t('action.stop'),
                    onClick: function () {
                      props.onStop();
                    },
                  },
                  h(Icon, { name: 'stop', size: 16 }),
                )
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'cd-send',
                    title: t('action.send'),
                    'aria-label': t('action.send'),
                    disabled:
                      (props.value.trim() === '' && props.attachments.length === 0) || props.transcribing,
                    onClick: submit,
                  },
                  h(Icon, { name: 'arrowUp', size: 18 }),
                ),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------- page */

    function ChatReplica(props) {
      const getTheme = props.getTheme;
      const getLocale = props.getLocale;
      const localeService = getLocale ? getLocale() : null;
      const wide = useMedia('(min-width: 768px)');
      const initial = useRef(null);
      if (initial.current === null) {
        initial.current = Object.assign(loadState(), {
          tts: loadTts(),
          drafts: loadDrafts(),
          fontSize: loadFontSize(),
        });
      }

      const [threads, setThreads] = useState(initial.current.threads);
      const [activeId, setActiveId] = useState(initial.current.activeId);
      const [drafts, setDrafts] = useState(function () {
        return initial.current.drafts;
      });
      const [localeId, setLocaleId] = useState(function () {
        return readLocaleId(localeService);
      });
      const [thinking, setThinking] = useState(function () {
        return initial.current.prefs.thinking;
      });
      const [search, setSearch] = useState(function () {
        return initial.current.prefs.search;
      });
      const [settingsOpen, setSettingsOpen] = useState(false);
      const [ttsVoice, setTtsVoice] = useState(function () {
        return initial.current.tts.voice;
      });
      const [autoRead, setAutoRead] = useState(function () {
        return initial.current.tts.auto;
      });
      const [fontSize, setFontSize] = useState(function () {
        return initial.current.fontSize;
      });
      const [speakingId, setSpeakingId] = useState(null);
      const [exportDir, setExportDir] = useState(function () {
        return loadExportDir();
      });
      const [pending, setPending] = useState(false);
      const [sidebarOpen, setSidebarOpen] = useState(wide);
      const [drawerOpen, setDrawerOpen] = useState(false);
      const [drawerClosing, setDrawerClosing] = useState(false);
      const [copiedId, setCopiedId] = useState(null);
      const [attachments, setAttachments] = useState([]);
      const [toast, setToast] = useState(null);
      const [recording, setRecording] = useState(false);
      const [transcribing, setTranscribing] = useState(false);
      const [selecting, setSelecting] = useState(false);
      const [selectedIds, setSelectedIds] = useState([]);
      const [renameTarget, setRenameTarget] = useState(null);
      const [deleteTarget, setDeleteTarget] = useState(null);
      const [editTarget, setEditTarget] = useState(null);
      /** 删除后 8 秒内可撤销；快照包含被删会话、草稿和当时的激活会话。 */
      const [undoDelete, setUndoDelete] = useState(null);
      const [storageError, setStorageError] = useState(false);
      /** 会话内查找：Ctrl/Cmd+F 打开，回车 / Shift+回车切换命中，Esc 关闭。 */
      const [findOpen, setFindOpen] = useState(false);
      const [findQuery, setFindQuery] = useState('');
      const [findIndex, setFindIndex] = useState(0);
      /** 模型选择：null = 跟随默认；目录由 Host 的 /models 提供。 */
      const [modelChoice, setModelChoice] = useState(function () {
        return loadModelChoice();
      });
      const [modelCatalog, setModelCatalog] = useState({ providers: [], current: null });
      const [modelMenu, setModelMenu] = useState(false);
      /** 当前 route 的上下文窗口；来自 /models 的 current 或每轮 chat 的 model 帧。 */
      const [contextWindow, setContextWindow] = useState(function () {
        return loadContextWindow();
      });
      /** 用量明细面板：'turn' | 'context' | null。 */
      const [usagePanel, setUsagePanel] = useState(null);

      const bodyRef = useRef(null);
      const jumpTimerRef = useRef(0);
      const [showJump, setShowJump] = useState(false);
      const findInputRef = useRef(null);
      const modelChoiceRef = useRef(modelChoice);
      modelChoiceRef.current = modelChoice;
      const textareaRef = useRef(null);
      const abortRef = useRef(null);
      const recorderRef = useRef(null);
      const toastTimerRef = useRef(null);
      const saveTimerRef = useRef(null);
      const undoTimerRef = useRef(null);
      const drawerTimerRef = useRef(null);
      const speechRef = useRef(null);
      const autoReadRef = useRef(false);
      const speakRef = useRef(null);
      const voiceRef = useRef('stella');
      /** 最新快照：防抖定时器和卸载补写都读它，避免写出过期数据。 */
      const latestSaveRef = useRef({ threads: initial.current.threads, activeId: initial.current.activeId });
      latestSaveRef.current = { threads: threads, activeId: activeId };

      /** 立即把当前对话写进 localStorage；结构性改动和卸载补写共用。 */
      const saveNow = useCallback(function (list, active) {
        try {
          window.localStorage.setItem(STORE_THREADS, JSON.stringify(list));
          if (active === null || active === undefined) window.localStorage.removeItem(STORE_ACTIVE);
          else window.localStorage.setItem(STORE_ACTIVE, active);
        } catch (error) {
          // 配额满时不能让界面报错，但必须让用户知道最近的改动可能没保存。
          setStorageError(true);
        }
      }, []);

      /** 草稿单独存：输入框按会话隔离，切换对话既不串也不丢。 */
      const latestDraftsRef = useRef(initial.current.drafts);
      latestDraftsRef.current = drafts;
      const saveDraftsNow = useCallback(function (map) {
        try {
          const clean = {};
          Object.keys(map).forEach(function (key) {
            if (typeof map[key] === 'string' && map[key] !== '') clean[key] = map[key];
          });
          if (Object.keys(clean).length === 0) window.localStorage.removeItem(STORE_DRAFTS);
          else window.localStorage.setItem(STORE_DRAFTS, JSON.stringify(clean));
        } catch (error) {
          setStorageError(true);
        }
      }, []);

      const draftKey = activeId === null ? DRAFT_NEW : activeId;
      const draft = drafts[draftKey] === undefined ? '' : drafts[draftKey];
      const setDraftFor = useCallback(function (key, value) {
        setDrafts(function (previous) {
          const currentValue = previous[key] === undefined ? '' : previous[key];
          const nextValue = typeof value === 'function' ? value(currentValue) : value;
          if (nextValue === currentValue) return previous;
          const next = Object.assign({}, previous);
          if (nextValue === '') delete next[key];
          else next[key] = nextValue;
          return next;
        });
      }, []);
      /** 输入框默认写当前会话；异步回调（如转写）也总能落到最新会话上。 */
      const draftKeyRef = useRef(draftKey);
      draftKeyRef.current = draftKey;
      const setDraft = useCallback(
        function (value) {
          setDraftFor(draftKeyRef.current, value);
        },
        [setDraftFor],
      );

      const dict = localeId === 'en' ? en : zh;
      const t = useCallback(
        function (key) {
          return dict[key] === undefined ? key : dict[key];
        },
        [dict],
      );

      useEffect(
        function () {
          if (!localeService) return undefined;
          const update = function () {
            setLocaleId(readLocaleId(localeService));
          };
          update();
          return localeService.subscribe(update);
        },
        [localeService],
      );

      useEffect(
        function () {
          try {
            window.localStorage.setItem(STORE_PREFS, JSON.stringify({ thinking: thinking, search: search }));
          } catch (error) {
            /* a full quota must not break the toggles */
          }
        },
        [thinking, search],
      );

      const activeThread = useMemo(
        function () {
          return (
            threads.find(function (thread) {
              return thread.id === activeId;
            }) || null
          );
        },
        [threads, activeId],
      );

      const findNeedle = findQuery.trim();
      /** 命中的消息（按消息计数，命中词会在正文里单独高亮）。 */
      const findMatches = useMemo(
        function () {
          const needle = findNeedle.toLowerCase();
          if (!findOpen || needle === '' || !activeThread) return [];
          return activeThread.messages.filter(function (message) {
            return typeof message.text === 'string' && message.text.toLowerCase().indexOf(needle) >= 0;
          });
        },
        [findOpen, findNeedle, activeThread],
      );
      const findActive = findMatches.length === 0 ? -1 : Math.min(findIndex, findMatches.length - 1);

      /** 本会话最后一次用到的 token 计数；用于上下文占用与「用量」行。 */
      const activeUsage = useMemo(
        function () {
          if (!activeThread) return null;
          for (let index = activeThread.messages.length - 1; index >= 0; index -= 1) {
            const message = activeThread.messages[index];
            if (message.role === 'assistant' && message.usage) {
              const totals = usageTotals(message.usage);
              if (totals !== null) {
                return { usage: message.usage, totals: totals, context: message.context || null };
              }
            }
          }
          return null;
        },
        [activeThread],
      );
      /** 近似上下文占用：上一次计费输入 + 本轮输出，占 route 声明的窗口。 */
      const occupancy = useMemo(
        function () {
          if (contextWindow === null || activeUsage === null) return null;
          const used = activeUsage.totals.input + activeUsage.totals.output;
          return {
            used: used,
            window: contextWindow,
            percent: Math.min(100, Math.round((used / contextWindow) * 100)),
          };
        },
        [contextWindow, activeUsage],
      );

      const closeFind = useCallback(function () {
        setFindOpen(false);
        setFindQuery('');
        setFindIndex(0);
      }, []);

      /** 打开查找条并把焦点放进输入框（标题栏与收起后的胶囊共用）。 */
      const openFind = useCallback(function () {
        setFindOpen(true);
        setTimeout(function () {
          const input = findInputRef.current;
          if (input && input.focus) input.focus();
        }, 0);
      }, []);

      const loadModels = useCallback(async function () {
        try {
          const response = await fetch(`${API}/models`, { headers: { accept: 'application/json' } });
          if (!response.ok) return;
          const body = await response.json();
          if (body && Array.isArray(body.providers)) {
            setModelCatalog({ providers: body.providers, current: body.current || null });
            if (body.current && typeof body.current.contextWindow === 'number' && body.current.contextWindow > 0) {
              setContextWindow(body.current.contextWindow);
              saveContextWindow(body.current.contextWindow);
            }
          }
        } catch (error) {
          /* keep the catalog we already have */
        }
      }, []);

      useEffect(
        function () {
          loadModels();
        },
        [loadModels],
      );

      useEffect(
        function () {
          if (!modelMenu) return;
          const onKey = function (event) {
            if (event.key === 'Escape') setModelMenu(false);
          };
          window.addEventListener('keydown', onKey);
          return function () {
            window.removeEventListener('keydown', onKey);
          };
        },
        [modelMenu],
      );

      useEffect(
        function () {
          if (usagePanel === null) return;
          const onKey = function (event) {
            if (event.key === 'Escape') setUsagePanel(null);
          };
          window.addEventListener('keydown', onKey);
          return function () {
            window.removeEventListener('keydown', onKey);
          };
        },
        [usagePanel],
      );

      // 切换会话时收起用量面板，避免展示上一条会话的数字。
      useEffect(
        function () {
          setUsagePanel(null);
        },
        [activeId],
      );

      // 切换会话时收起查找条，避免旧查询挂在新对话上。
      useEffect(
        function () {
          if (findOpen) closeFind();
        },
        [activeId],
      );

      const stepFind = useCallback(
        function (delta) {
          setFindIndex(function (current) {
            if (findMatches.length === 0) return 0;
            const base = current >= findMatches.length ? 0 : current;
            return (base + delta + findMatches.length) % findMatches.length;
          });
        },
        [findMatches.length],
      );

      useEffect(
        function () {
          if (!findOpen || findMatches.length === 0) return;
          const message = findMatches[Math.min(findIndex, findMatches.length - 1)];
          if (!message) return;
          const scope =
            typeof document !== 'undefined' && document && typeof document.querySelector === 'function'
              ? document.querySelector('[data-mid="' + message.id + '"]')
              : null;
          if (scope && typeof scope.scrollIntoView === 'function') {
            scope.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        },
        [findOpen, findIndex, findMatches],
      );

      // Ctrl/Cmd+F 打开会话内查找；对话框打开时让位给它们自己的快捷键。
      useEffect(
        function () {
          const onKey = function (event) {
            if (!(event.metaKey || event.ctrlKey) || (event.key !== 'f' && event.key !== 'F')) return;
            if (!activeThread || settingsOpen || renameTarget !== null || deleteTarget !== null || editTarget !== null) return;
            event.preventDefault();
            setFindOpen(true);
            setTimeout(function () {
              const input = findInputRef.current;
              if (input && input.focus) input.focus();
            }, 0);
          };
          window.addEventListener('keydown', onKey);
          return function () {
            window.removeEventListener('keydown', onKey);
          };
        },
        [activeThread, settingsOpen, renameTarget, deleteTarget, editTarget],
      );

      useEffect(
        function () {
          setSidebarOpen(wide);
          if (wide) {
            setDrawerOpen(false);
            setDrawerClosing(false);
          }
        },
        [wide],
      );

      /** Slide the drawer out linearly and keep it mounted for that duration. */
      const closeDrawer = useCallback(function () {
        setDrawerOpen(false);
        setDrawerClosing(true);
        if (drawerTimerRef.current) clearTimeout(drawerTimerRef.current);
        drawerTimerRef.current = setTimeout(function () {
          drawerTimerRef.current = null;
          setDrawerClosing(false);
        }, DRAWER_MS);
      }, []);

      const openDrawer = useCallback(function () {
        if (drawerTimerRef.current) {
          clearTimeout(drawerTimerRef.current);
          drawerTimerRef.current = null;
        }
        setDrawerClosing(false);
        setDrawerOpen(true);
      }, []);

      /** Debounced persistence keeps a long stream from writing on every token. */
      useEffect(
        function () {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(function () {
            saveTimerRef.current = null;
            saveNow(latestSaveRef.current.threads, latestSaveRef.current.activeId);
          }, 400);
          return function () {
            if (saveTimerRef.current) {
              clearTimeout(saveTimerRef.current);
              saveTimerRef.current = null;
            }
          };
        },
        [threads, activeId, saveNow],
      );

      /** 草稿变化也做短防抖：打字不落盘，停手 300 ms 后一次写入。 */
      useEffect(
        function () {
          const timer = setTimeout(function () {
            saveDraftsNow(latestDraftsRef.current);
          }, 300);
          return function () {
            clearTimeout(timer);
          };
        },
        [drafts, saveDraftsNow],
      );

      /**
       * 切换面板会卸载本页，而上面的清理函数会取消待写的防抖任务，导致刚删除 /
       * 置顶 / 改名的对话在重新进入时“复活”。卸载前补写一次快照；App 关闭
       * （pagehide）同样补写一次。
       */
      useEffect(
        function () {
          const flush = function () {
            if (saveTimerRef.current) {
              clearTimeout(saveTimerRef.current);
              saveTimerRef.current = null;
            }
            saveNow(latestSaveRef.current.threads, latestSaveRef.current.activeId);
            saveDraftsNow(latestDraftsRef.current);
          };
          window.addEventListener('pagehide', flush);
          return function () {
            window.removeEventListener('pagehide', flush);
            flush();
          };
        },
        [saveNow, saveDraftsNow],
      );

      useEffect(
        function () {
          return function () {
            if (abortRef.current) abortRef.current.abort();
            if (recorderRef.current) {
              const recorder = recorderRef.current;
              recorderRef.current = null;
              try {
                recorder.stream.getTracks().forEach(function (track) {
                  track.stop();
                });
                recorder.context.close();
              } catch (error) {
                /* teardown races are harmless */
              }
            }
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            if (drawerTimerRef.current) clearTimeout(drawerTimerRef.current);
            if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
          };
        },
        [],
      );

      useEffect(
        function () {
          const element = bodyRef.current;
          if (!element) return;
          element.scrollTop = element.scrollHeight;
          setShowJump(false);
        },
        [threads, activeId],
      );
      /** 消息区滚离底部超过一屏时显示「回到底部」，点击后线性滚回。 */
      const syncJumpButton = function (element) {
        if (!element) return;
        const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
        setShowJump(Number.isFinite(distance) && distance > 240);
      };

      const jumpToBottom = function () {
        const element = bodyRef.current;
        if (!element) return;
        const start = element.scrollTop;
        const target = element.scrollHeight - element.clientHeight;
        if (!Number.isFinite(target) || target <= start) {
          setShowJump(false);
          return;
        }
        const reduceMotion =
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
          element.scrollTop = target;
          setShowJump(false);
          return;
        }
        const duration = 280;
        const startedAt = Date.now();
        if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
        const tick = function () {
          const progress = Math.min(1, (Date.now() - startedAt) / duration);
          element.scrollTop = start + (target - start) * progress;
          if (progress < 1) {
            jumpTimerRef.current = setTimeout(tick, 16);
          } else {
            jumpTimerRef.current = 0;
            setShowJump(false);
          }
        };
        tick();
      };

      /** Keep an explicit 「跟随系统」 choice in step with the phone's switch. */
      useEffect(
        function () {
          if (loadThemePreference() !== 'system') return undefined;
          const apply = function () {
            applySystemTheme(getTheme ? getTheme() : null);
          };
          apply();
          const onVisible = function () {
            if (document.visibilityState === 'visible') apply();
          };
          document.addEventListener('visibilitychange', onVisible);
          window.addEventListener('focus', onVisible);
          return function () {
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
          };
        },
        [getTheme],
      );


      const showToast = useCallback(function (message) {
        setToast(message);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(function () {
          toastTimerRef.current = null;
          setToast(null);
        }, 2600);
      }, []);

      /** 写 localStorage 失败（配额满）时给一次可见的提示，而不是悄悄丢数据。 */
      useEffect(
        function () {
          if (!storageError) return;
          setStorageError(false);
          showToast(t('toast.storageFull'));
        },
        [storageError, showToast, t],
      );

      useEffect(
        function () {
          autoReadRef.current = autoRead;
        },
        [autoRead],
      );

      useEffect(
        function () {
          voiceRef.current = ttsVoice;
          saveTts(ttsVoice, autoReadRef.current);
        },
        [ttsVoice],
      );

      const stopSpeaking = useCallback(function () {
        const current = speechRef.current;
        speechRef.current = null;
        setSpeakingId(null);
        if (current === null) return;
        try {
          current.controller.abort();
        } catch (error) {
          /* already aborted */
        }
        try {
          current.context.close();
        } catch (error) {
          /* already closed */
        }
      }, []);

      const scheduleSamples = function (state, samples) {
        if (state.context.state === 'closed') return;
        const buffer = state.context.createBuffer(1, samples.length, 24000);
        buffer.copyToChannel(samples, 0);
        const source = state.context.createBufferSource();
        source.buffer = buffer;
        source.connect(state.context.destination);
        const start = Math.max(state.nextTime, state.context.currentTime + 0.06);
        source.start(start);
        state.nextTime = start + buffer.duration;
        state.sources += 1;
        source.onended = function () {
          state.sources -= 1;
        };
      };

      /** Read one assistant message aloud through the Host TTS proxy. */
      const speak = useCallback(
        async function (message) {
          const text = message && typeof message.text === 'string' ? message.text.trim() : '';
          if (text === '') {
            showToast(t('toast.ttsUnavailable'));
            return;
          }
          const current = speechRef.current;
          if (current !== null && current.messageId === message.id) {
            stopSpeaking();
            return;
          }
          stopSpeaking();
          const Ctor = window.AudioContext || window.webkitAudioContext;
          if (!Ctor) {
            showToast(t('toast.ttsFailed'));
            return;
          }
          let context;
          try {
            context = new Ctor({ sampleRate: 24000 });
          } catch (error) {
            context = new Ctor();
          }
          const controller = new AbortController();
          const state = { messageId: message.id, controller: controller, context: context, nextTime: 0, sources: 0 };
          speechRef.current = state;
          setSpeakingId(message.id);
          let finalText = '';
          try {
            const response = await fetch(API + '/tts', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text: text, voice: voiceRef.current }),
              signal: controller.signal,
            });
            if (!response.ok) {
              let detail = '';
              try {
                const body = await response.json();
                detail = body.message || body.error || '';
              } catch (error) {
                detail = '';
              }
              throw new Error(detail || 'HTTP ' + response.status);
            }
            const reader = response.body.getReader();
            let carry = null;
            for (;;) {
              const step = await reader.read();
              if (step.done) break;
              let bytes = step.value;
              if (carry !== null) {
                const merged = new Uint8Array(carry.length + bytes.length);
                merged.set(carry, 0);
                merged.set(bytes, carry.length);
                bytes = merged;
                carry = null;
              }
              const usable = bytes.length - (bytes.length % 2);
              if (usable === 0) {
                carry = bytes;
                continue;
              }
              if (usable < bytes.length) carry = bytes.slice(usable);
              const view = new DataView(bytes.buffer, bytes.byteOffset, usable);
              const samples = new Float32Array(usable / 2);
              for (let index = 0; index < samples.length; index += 1) {
                samples[index] = view.getInt16(index * 2, true) / 32768;
              }
              scheduleSamples(state, samples);
            }
            const poll = function () {
              if (speechRef.current !== state) return;
              if (state.context.state === 'closed') return;
              if (state.sources > 0 || state.nextTime > state.context.currentTime) {
                setTimeout(poll, 250);
                return;
              }
              stopSpeaking();
            };
            setTimeout(poll, 300);
          } catch (error) {
            if (controller.signal.aborted) return;
            stopSpeaking();
            const message_ = String(error && error.message ? error.message : error);
            showToast(message_.indexOf('no-key') >= 0 ? t('toast.ttsNoKey') : t('toast.ttsFailed'));
          }
        },
        [showToast, stopSpeaking, t],
      );

      useEffect(
        function () {
          speakRef.current = speak;
        },
        [speak],
      );


      const patchMessage = useCallback(function (threadId, messageId, mutate) {
        setThreads(function (previous) {
          return previous.map(function (thread) {
            if (thread.id !== threadId) return thread;
            return Object.assign({}, thread, {
              messages: thread.messages.map(function (message) {
                if (message.id !== messageId) return message;
                return Object.assign({}, message, mutate(message));
              }),
            });
          });
        });
      }, []);

      /** Run one model turn against the Host route and fold the NDJSON stream in. */
      const runAssistant = useCallback(
        async function (threadId, history, assistantId, deepThinking, webSearch) {
          setThreads(function (previous) {
            return previous.map(function (thread) {
              if (thread.id !== threadId) return thread;
              return Object.assign({}, thread, {
                updatedAt: Date.now(),
                messages: thread.messages.concat({ id: assistantId, role: 'assistant', text: '', reasoning: '', at: Date.now() }),
              });
            });
          });
          setPending(true);
          const controller = new AbortController();
          abortRef.current = controller;
          const lastUser = history
            .slice()
            .reverse()
            .find(function (message) {
              return message.role === 'user';
            });
          const payload = {
            thinking: deepThinking === true,
            search: webSearch === true,
            ...(modelChoiceRef.current ? { model: modelChoiceRef.current } : {}),
            query: lastUser && typeof lastUser.text === 'string' ? lastUser.text : '',
            messages: await Promise.all(
              history.map(async function (message) {
                return { role: message.role, text: await composeMessageText(message) };
              }),
            ),
          };
          try {
            const response = await fetch(`${API}/chat`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            if (!response.ok) {
              let detail = '';
              try {
                const body = await response.json();
                detail = body.message || body.error || '';
              } catch (error) {
                detail = '';
              }
              throw new Error(detail || `HTTP ${response.status}`);
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffered = '';
            let text = '';
            let reasoning = '';
            for (;;) {
              const step = await reader.read();
              if (step.done) break;
              buffered += decoder.decode(step.value, { stream: true });
              let newline = buffered.indexOf('\n');
              while (newline >= 0) {
                const line = buffered.slice(0, newline).trim();
                buffered = buffered.slice(newline + 1);
                newline = buffered.indexOf('\n');
                if (line === '') continue;
                let frame;
                try {
                  frame = JSON.parse(line);
                } catch (error) {
                  continue;
                }
                if (frame.type === 'text') {
                  text += frame.text;
                  patchMessage(threadId, assistantId, function () {
                    return { text: text };
                  });
                } else if (frame.type === 'reasoning') {
                  reasoning += frame.text;
                  patchMessage(threadId, assistantId, function () {
                    return { reasoning: reasoning };
                  });
                } else if (frame.type === 'search') {
                  patchMessage(threadId, assistantId, function (current) {
                    return {
                      search: {
                        phase: frame.phase,
                        sources: frame.sources || (current.search && current.search.sources) || [],
                        message: frame.message || '',
                      },
                    };
                  });
                } else if (frame.type === 'usage') {
                  patchMessage(threadId, assistantId, function () {
                    return { usage: frame.usage || null };
                  });
                } else if (frame.type === 'context') {
                  patchMessage(threadId, assistantId, function () {
                    return {
                      context: {
                        system: Number(frame.system) || 0,
                        messages: Number(frame.messages) || 0,
                        tools: Number(frame.tools) || 0,
                      },
                    };
                  });
                } else if (frame.type === 'model') {
                  if (typeof frame.contextWindow === 'number' && frame.contextWindow > 0) {
                    setContextWindow(frame.contextWindow);
                    saveContextWindow(frame.contextWindow);
                  }
                } else if (frame.type === 'error') {
                  patchMessage(threadId, assistantId, function () {
                    return { error: frame.message || t('toast.network') };
                  });
                }
              }
            }
            finalText = text;
            patchMessage(threadId, assistantId, function () {
              return {};
            });
          } catch (error) {
            if (controller.signal.aborted) {
              patchMessage(threadId, assistantId, function () {
                return { stopped: true };
              });
            } else {
              const message =
                error && error.name === 'TypeError'
                  ? t('toast.network')
                  : error && error.message
                    ? error.message
                    : String(error);
              patchMessage(threadId, assistantId, function () {
                return { error: message };
              });
            }
          } finally {
            abortRef.current = null;
            setPending(false);
            if (autoReadRef.current && !controller.signal.aborted && finalText.trim() !== '' && speakRef.current !== null) {
              speakRef.current({ id: assistantId, role: 'assistant', text: finalText });
            }
          }
        },
        [patchMessage, t],
      );

      const send = useCallback(
        function () {
          const text = draft.trim();
          if ((text === '' && attachments.length === 0) || pending) return;
          const targetId = activeId || newId('c');
          const stamp = Date.now();
          const files = [];
          const images = [];
          attachments.forEach(function (file) {
            if (file.kind === 'image') images.push({ id: file.imageId, name: file.name });
            else {
              files.push({
                name: file.name,
                text: file.text,
                ...(typeof file.size === 'number' ? { size: file.size } : {}),
                ...(typeof file.fileId === 'string' ? { fileId: file.fileId } : {}),
              });
            }
          });
          const userMessage = {
            id: newId('u'),
            role: 'user',
            text: text,
            at: stamp,
            ...(files.length > 0 ? { files: files } : {}),
            ...(images.length > 0 ? { images: images } : {}),
          };
          const existing = threads.find(function (thread) {
            return thread.id === targetId;
          });
          const history = (existing ? existing.messages : []).concat(userMessage);
          setThreads(function (previous) {
            const exists = previous.some(function (thread) {
              return thread.id === targetId;
            });
            if (!exists) {
              return [
                {
                  id: targetId,
                  title: text.slice(0, 24) || (files[0] ? files[0].name : images[0] ? images[0].name : t('action.newChat')),
                  updatedAt: stamp,
                  messages: [userMessage],
                },
              ].concat(previous);
            }
            return previous.map(function (thread) {
              if (thread.id !== targetId) return thread;
              return Object.assign({}, thread, {
                updatedAt: stamp,
                messages: thread.messages.concat(userMessage),
              });
            });
          });
          setActiveId(targetId);
          setDraftFor(activeId === null ? DRAFT_NEW : activeId, '');
          setAttachments([]);
          runAssistant(targetId, history, newId('a'), thinking, search);
        },
        [draft, attachments, pending, activeId, threads, runAssistant, t, thinking, search, setDraftFor],
      );

      const regenerate = useCallback(
        function () {
          if (!activeThread || pending) return;
          const messages = activeThread.messages;
          let cut = messages.length;
          while (cut > 0 && messages[cut - 1].role === 'assistant') cut -= 1;
          const kept = messages.slice(0, cut);
          setThreads(function (previous) {
            return previous.map(function (thread) {
              if (thread.id !== activeThread.id) return thread;
              return Object.assign({}, thread, { messages: kept });
            });
          });
          runAssistant(activeThread.id, kept, newId('a'), thinking, search);
        },
        [activeThread, pending, runAssistant, thinking, search],
      );

      const stop = useCallback(function () {
        if (abortRef.current) abortRef.current.abort();
        setPending(false);
      }, []);

      /** 编辑某条用户消息：截断到该条并重新生成回答。 */
      const applyEdit = useCallback(
        function (messageId, text) {
          const thread = activeThread;
          if (!thread) return;
          const index = thread.messages.findIndex(function (message) {
            return message.id === messageId;
          });
          if (index < 0) return;
          if (abortRef.current) abortRef.current.abort();
          setPending(false);
          const edited = Object.assign({}, thread.messages[index], { text: text });
          const history = thread.messages.slice(0, index).concat(edited);
          setThreads(function (previous) {
            return previous.map(function (item) {
              if (item.id !== thread.id) return item;
              return Object.assign({}, item, { updatedAt: Date.now(), messages: history });
            });
          });
          runAssistant(thread.id, history, newId('a'), thinking, search);
        },
        [activeThread, thinking, search, runAssistant],
      );

      /** 从某条回答分叉：把到该条为止的消息复制成新会话，接着换个方向继续问。 */
      const forkThread = useCallback(
        function (messageId) {
          const source = activeThread;
          if (!source) return;
          const index = source.messages.findIndex(function (message) {
            return message.id === messageId;
          });
          if (index < 0) return;
          const messages = source.messages.slice(0, index + 1).map(function (message) {
            return Object.assign({}, message, { id: newId('m') });
          });
          const forked = {
            id: newId('c'),
            title: source.title + ' · ' + t('fork.suffix'),
            updatedAt: Date.now(),
            messages: messages,
          };
          const next = [forked].concat(threads);
          setThreads(next);
          setActiveId(forked.id);
          saveNow(next, forked.id);
          showToast(t('toast.forked'));
        },
        [activeThread, threads, t, saveNow, showToast],
      );

      const copy = function (message) {
        const finish = function () {
          setCopiedId(message.id);
          setTimeout(function () {
            setCopiedId(function (current) {
              return current === message.id ? null : current;
            });
          }, 1500);
        };
        const fallback = function () {
          try {
            const scratch = document.createElement('textarea');
            scratch.value = message.text;
            scratch.setAttribute('readonly', '');
            scratch.style.position = 'fixed';
            scratch.style.opacity = '0';
            document.body.appendChild(scratch);
            scratch.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(scratch);
            if (ok) finish();
          } catch (error) {
            /* stay silent when every copy path is refused */
          }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(message.text).then(finish, fallback);
        } else {
          fallback();
        }
      };

      const pickFiles = useCallback(
        async function (fileList) {
          const picked = Array.prototype.slice.call(fileList);
          for (const file of picked) {
            if (attachments.length >= ATTACHMENT_LIMIT) {
              showToast(t('toast.fileLimit'));
              break;
            }
            if (typeof file.type === 'string' && file.type.indexOf('image/') === 0) {
              if (file.size > IMAGE_FILE_LIMIT) {
                showToast(t('toast.imageTooLarge'));
                continue;
              }
              const blob = await prepareImageBlob(file);
              const imageId = newId('img');
              await putImage(imageId, blob);
              setAttachments(function (previous) {
                if (previous.length >= ATTACHMENT_LIMIT) return previous;
                return previous.concat({ id: newId('f'), kind: 'image', name: file.name, imageId: imageId });
              });
              continue;
            }
            if (file.size > TEXT_FILE_LIMIT) {
              showToast(t('toast.fileTooLarge'));
              continue;
            }
            let content = '';
            try {
              content = await file.text();
            } catch (error) {
              showToast(t('toast.fileUnsupported'));
              continue;
            }
            if (content.indexOf('\u0000') >= 0) {
              showToast(t('toast.fileUnsupported'));
              continue;
            }
            const fileId = newId('file');
            await putStoredFile(fileId, content);
            setAttachments(function (previous) {
              if (previous.length >= ATTACHMENT_LIMIT) return previous;
              return previous.concat({
                id: newId('f'),
                name: file.name,
                size: content.length,
                text: '',
                fileId: fileId,
              });
            });
          }
        },
        [attachments.length, showToast, t],
      );

      const removeFile = function (id) {
        setAttachments(function (previous) {
          return previous.filter(function (file) {
            return file.id !== id;
          });
        });
      };

      const transcribe = useCallback(
        async function (blob, seconds) {
          if (seconds < 0.5) {
            showToast(t('toast.tooShort'));
            return;
          }
          setTranscribing(true);
          try {
            const response = await fetch(`${API}/transcribe?lang=zh`, {
              method: 'POST',
              headers: { 'content-type': 'audio/wav' },
              body: blob,
            });
            const body = await response.json().catch(function () {
              return {};
            });
            if (!response.ok) throw new Error(body.message || body.error || 'asr-failed');
            const text = typeof body.text === 'string' ? body.text.trim() : '';
            if (text === '') {
              showToast(t('toast.emptyTranscript'));
              return;
            }
            setDraft(function (current) {
              return current.trim() === '' ? text : `${current}${text}`;
            });
          } catch (error) {
            const detail = error && error.message && error.message !== 'asr-failed' ? error.message : '';
            showToast(detail === '' ? t('toast.asrFailed') : `${t('toast.asrFailed')}：${detail}`);
          } finally {
            setTranscribing(false);
          }
        },
        [showToast, t],
      );

      const toggleVoice = useCallback(
        async function () {
          if (transcribing) return;
          if (recorderRef.current !== null) {
            const recorder = recorderRef.current;
            recorderRef.current = null;
            setRecording(false);
            let result;
            try {
              result = await endRecording(recorder);
            } catch (error) {
              showToast(t('toast.asrFailed'));
              return;
            }
            transcribe(result.blob, result.seconds);
            return;
          }
          try {
            recorderRef.current = await beginRecording();
            setRecording(true);
          } catch (error) {
            recorderRef.current = null;
            setRecording(false);
            showToast(t('toast.micDenied'));
          }
        },
        [transcribing, transcribe, showToast, t],
      );

      const startNew = function () {
        if (abortRef.current) abortRef.current.abort();
        setPending(false);
        setActiveId(null);
        setDraftFor(DRAFT_NEW, '');
        setAttachments([]);
        closeDrawer();
        setTimeout(function () {
          if (textareaRef.current) textareaRef.current.focus();
        }, 0);
      };

      const select = function (id) {
        if (abortRef.current) abortRef.current.abort();
        setPending(false);
        setActiveId(id);
        closeDrawer();
        setAttachments([]);
      };

      /** 删除立即落盘：切走面板会卸载本页，不能等防抖任务。 */
      const dropThreads = useCallback(
        function (ids) {
          if (ids.length === 0) return;
          if (abortRef.current) abortRef.current.abort();
          setPending(false);
          const next = threads.filter(function (thread) {
            return ids.indexOf(thread.id) < 0;
          });
          const nextActive = activeId !== null && ids.indexOf(activeId) >= 0 ? null : activeId;
          setThreads(next);
          setActiveId(nextActive);
          saveNow(next, nextActive);
          setDrafts(function (previous) {
            let removed = false;
            const kept = {};
            Object.keys(previous).forEach(function (key) {
              if (ids.indexOf(key) >= 0) removed = true;
              else kept[key] = previous[key];
            });
            return removed ? kept : previous;
          });
        },
        [threads, activeId, saveNow],
      );

      /** 删除一律先弹二次确认，确认后才真正丢弃（不可恢复）。 */
      const requestDelete = useCallback(function (ids) {
        if (ids.length === 0) return;
        setDeleteTarget({ ids: ids });
      }, []);

      const confirmDelete = useCallback(
        function () {
          const ids = deleteTarget ? deleteTarget.ids : [];
          setDeleteTarget(null);
          if (ids.length === 0) return;
          const removed = threads.filter(function (thread) {
            return ids.indexOf(thread.id) >= 0;
          });
          const removedDrafts = {};
          ids.forEach(function (id) {
            if (drafts[id] !== undefined) removedDrafts[id] = drafts[id];
          });
          dropThreads(ids);
          setSelecting(false);
          setSelectedIds([]);
          if (removed.length === 0) return;
          // 只保留最近一次删除的撤销快照：再删一次，上一次就过期了。
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
          setUndoDelete({ threads: removed, drafts: removedDrafts, activeId: activeId });
          undoTimerRef.current = setTimeout(function () {
            undoTimerRef.current = null;
            setUndoDelete(null);
          }, UNDO_MS);
        },
        [deleteTarget, threads, drafts, activeId, dropThreads],
      );

      /** 8 秒内点「撤销」：恢复会话、草稿；如果被删的是当时打开的会话就重新打开它。 */
      const undoDeleteNow = useCallback(
        function () {
          const snapshot = undoDelete;
          if (!snapshot) return;
          if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
            undoTimerRef.current = null;
          }
          setUndoDelete(null);
          const next = snapshot.threads.concat(threads);
          const nextActive = activeId === null && snapshot.activeId !== null ? snapshot.activeId : activeId;
          setThreads(next);
          setActiveId(nextActive);
          saveNow(next, nextActive);
          if (Object.keys(snapshot.drafts).length > 0) {
            setDrafts(function (previous) {
              return Object.assign({}, previous, snapshot.drafts);
            });
          }
        },
        [undoDelete, threads, activeId, saveNow],
      );

      const renameThread = useCallback(
        function (id, title) {
          const next = threads.map(function (thread) {
            if (thread.id !== id) return thread;
            return Object.assign({}, thread, { title: title });
          });
          setThreads(next);
          saveNow(next, activeId);
        },
        [threads, activeId, saveNow],
      );

      const togglePin = useCallback(
        function (id) {
          const next = threads.map(function (thread) {
            if (thread.id !== id) return thread;
            if (typeof thread.pinnedAt === 'number') {
              const copy = Object.assign({}, thread);
              delete copy.pinnedAt;
              return copy;
            }
            return Object.assign({}, thread, { pinnedAt: Date.now() });
          });
          setThreads(next);
          saveNow(next, activeId);
        },
        [threads, activeId, saveNow],
      );

      const enterSelect = useCallback(function (id) {
        setSelecting(true);
        setSelectedIds(id ? [id] : []);
      }, []);

      const exitSelect = useCallback(function () {
        setSelecting(false);
        setSelectedIds([]);
      }, []);

      /** 多选模式下按 Esc 退出；对话框和搜索框会先消费自己的 Esc。 */
      useEffect(
        function () {
          if (!selecting) return undefined;
          const onKeyDown = function (event) {
            if (event.key === 'Escape') exitSelect();
          };
          document.addEventListener('keydown', onKeyDown);
          return function () {
            document.removeEventListener('keydown', onKeyDown);
          };
        },
        [selecting, exitSelect],
      );

      const toggleSelect = useCallback(function (id) {
        setSelectedIds(function (previous) {
          return previous.indexOf(id) >= 0
            ? previous.filter(function (item) {
                return item !== id;
              })
            : previous.concat([id]);
        });
      }, []);

      /** 多选置顶：全部已置顶时改为取消置顶，否则按选择顺序依次置顶。 */
      const pinSelected = useCallback(
        function () {
          const ids = selectedIds.slice();
          if (ids.length === 0) return;
          let pinned = 0;
          ids.forEach(function (id) {
            const thread = threads.find(function (item) {
              return item.id === id;
            });
            if (thread && typeof thread.pinnedAt === 'number') pinned += 1;
          });
          const unpin = pinned === ids.length;
          const stamp = Date.now();
          const next = threads.map(function (thread) {
            const index = ids.indexOf(thread.id);
            if (index < 0) return thread;
            if (unpin) {
              const copy = Object.assign({}, thread);
              delete copy.pinnedAt;
              return copy;
            }
            return Object.assign({}, thread, { pinnedAt: stamp - index });
          });
          setThreads(next);
          saveNow(next, activeId);
          setSelecting(false);
          setSelectedIds([]);
        },
        [selectedIds, threads, activeId, saveNow],
      );

      const requestDeleteSelected = useCallback(function () {
        if (selectedIds.length === 0) return;
        setDeleteTarget({ ids: selectedIds.slice() });
      }, [selectedIds]);

      /** 线程被删除（含导入覆盖）后，选中集合不能残留已消失的 id。 */
      useEffect(
        function () {
          if (selectedIds.length === 0) return;
          const alive = selectedIds.filter(function (id) {
            return threads.some(function (thread) {
              return thread.id === id;
            });
          });
          if (alive.length !== selectedIds.length) setSelectedIds(alive);
        },
        [threads, selectedIds],
      );

      const exportConversations = useCallback(
        async function (dir, list, format) {
          const source = Array.isArray(list) ? list : threads;
          const wanted = format === 'markdown' ? 'markdown' : 'json';
          const attempt = async function () {
            const response = await fetch(`${API}/export`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                threads: await Promise.all(source.map(exportThread)),
                dir: dir,
                format: wanted,
              }),
            });
            const text = await response.text();
            let body = {};
            try {
              body = JSON.parse(text);
            } catch (error) {
              body = {};
            }
            if (!response.ok) {
              const reason = body.message || body.error || 'HTTP ' + response.status;
              return { ok: false, text: t('toast.exportFailed') + '：' + reason };
            }
            return { ok: true, text: t('toast.exported').replace('{path}', shortPath(body.path || '')) };
          };
          try {
            return await attempt();
          } catch (error) {
            try {
              return await attempt();
            } catch (second) {
              return { ok: false, text: t('toast.exportFailed') + '：' + ((second && second.message) || String(second)) };
            }
          }
        },
        [threads, t],
      );

      /** 导出为官方 App 的 ZIP 结构：页面打包（含图片），Host 写进导出目录。 */
      const exportOfficial = useCallback(
        async function () {
          if (threads.length === 0) return { ok: false, text: t('toast.exportFailed') };
          let bytes;
          try {
            bytes = await buildOfficialArchive(threads);
          } catch (error) {
            return { ok: false, text: t('toast.exportFailed') };
          }
          const attempt = async function () {
            const response = await fetch(
              `${API}/export-official?dir=${encodeURIComponent(exportDir)}`,
              { method: 'POST', headers: { 'content-type': 'application/zip' }, body: bytes },
            );
            const text = await response.text();
            let body = {};
            try {
              body = JSON.parse(text);
            } catch (error) {
              body = {};
            }
            if (!response.ok) {
              const reason = body.message || body.error || 'HTTP ' + response.status;
              return { ok: false, text: t('toast.exportFailed') + '：' + reason };
            }
            return { ok: true, text: t('toast.exported').replace('{path}', shortPath(body.path || '')) };
          };
          try {
            return await attempt();
          } catch (error) {
            try {
              return await attempt();
            } catch (second) {
              return { ok: false, text: t('toast.exportFailed') + '：' + ((second && second.message) || String(second)) };
            }
          }
        },
        [threads, exportDir, t],
      );

      /** 多选导出：只导出选中的会话，写入当前「导出位置」。 */
      const exportSelected = useCallback(
        async function () {
          const chosen = threads.filter(function (thread) {
            return selectedIds.indexOf(thread.id) >= 0;
          });
          if (chosen.length === 0) return;
          const result = await exportConversations(exportDir, chosen);
          showToast(result.text);
          if (result.ok) {
            setSelecting(false);
            setSelectedIds([]);
          }
        },
        [threads, selectedIds, exportDir, exportConversations, showToast],
      );

      /** 单条导出：从会话菜单里导出这一条（JSON 备份或 Markdown 阅读稿）。 */
      const exportThreadById = useCallback(
        async function (id, format) {
          const thread = threads.find(function (item) {
            return item.id === id;
          });
          if (!thread) return;
          const result = await exportConversations(exportDir, [thread], format);
          showToast(result.text);
        },
        [threads, exportDir, exportConversations, showToast],
      );

      const listDirectory = useCallback(
        async function (path) {
          const workspace = props.getWorkspace ? props.getWorkspace() : null;
          if (!workspace || typeof workspace.listDirectory !== 'function') throw new Error('directory-unavailable');
          // 空字符串表示「让 Host 用默认位置」，不要把它当成相对路径传下去。
          return workspace.listDirectory(path === '' ? undefined : path);
        },
        [props],
      );

      const toggleAutoRead = function () {
        const next = !autoRead;
        setAutoRead(next);
        saveTts(ttsVoice, next);
        if (!next) stopSpeaking();
      };

      const changeVoice = useCallback(
        function (id) {
          const next = isVoiceId(id) ? id : 'stella';
          voiceRef.current = next;
          setTtsVoice(next);
          saveTts(next, autoRead);
        },
        [autoRead],
      );

      const changeFontSize = useCallback(function (id) {
        const next = FONT_IDS.indexOf(id) >= 0 ? id : 'standard';
        setFontSize(next);
        saveFontSize(next);
      }, []);

      const chooseExportDir = useCallback(function (dir) {
        setExportDir(dir);
        try {
          window.localStorage.setItem(STORE_EXPORT_DIR, dir);
        } catch (error) {
          /* the choice still holds for this page */
        }
      }, []);

      const importConversations = useCallback(
        async function (file) {
          try {
            const name = typeof file.name === 'string' ? file.name.toLowerCase() : '';
            let imported;
            if (name.endsWith('.zip')) {
              imported = await importOfficialArchive(file);
            } else {
              const payload = JSON.parse(await file.text());
              const list = Array.isArray(payload) ? payload : Array.isArray(payload && payload.threads) ? payload.threads : null;
              if (list === null) throw new Error('bad-format');
              imported = normalizeThreads(list);
            }
            imported = await offloadFileBodies(imported);
            if (imported.length === 0) throw new Error('empty');
            /** 同一个文件导入两次、或文件内部有重复条目，都只保留一份。 */
            const seen = {};
            threads.forEach(function (thread) {
              seen[threadFingerprint(thread)] = true;
            });
            const fresh = [];
            imported.forEach(function (thread) {
              const fingerprint = threadFingerprint(thread);
              if (seen[fingerprint]) return;
              seen[fingerprint] = true;
              fresh.push(thread);
            });
            const skipped = imported.length - fresh.length;
            if (fresh.length === 0) {
              return { ok: true, text: t('toast.importedNone').replace('{count}', String(skipped)) };
            }
            const next = fresh.concat(threads);
            setThreads(next);
            setActiveId(fresh[0].id);
            saveNow(next, fresh[0].id);
            if (skipped > 0) {
              return {
                ok: true,
                text: t('toast.importedSkipped')
                  .replace('{count}', String(fresh.length))
                  .replace('{skipped}', String(skipped)),
              };
            }
            return { ok: true, text: t('toast.imported').replace('{count}', String(fresh.length)) };
          } catch (error) {
            const code = error && error.message ? error.message : '';
            const key =
              code === 'not-zip' || code === 'bad-local-header' || code === 'zip64'
                ? 'import.badZip'
                : code === 'unsupported-compression'
                  ? 'import.unsupported'
                  : code === 'unzip-unavailable'
                    ? 'import.noUnzip'
                    : code === 'no-sessions'
                      ? 'import.noSessions'
                      : 'toast.importFailed';
            return { ok: false, text: t(key) };
          }
        },
        [t, threads, saveNow],
      );

      const deleteAllConversations = useCallback(
        function () {
          if (abortRef.current) abortRef.current.abort();
          setPending(false);
          setThreads([]);
          setActiveId(null);
          setDrafts({});
          saveNow([], null);
          saveDraftsNow({});
        },
        [saveNow, saveDraftsNow],
      );

      const collapsed = !wide || !sidebarOpen;
      const sidebarVisible = wide ? sidebarOpen : drawerOpen;
      const hasMessages = !!activeThread && activeThread.messages.length > 0;

      const renderActions = function (message, extra) {
        const clock = formatClock(message.at);
        return h(
          'div',
          { className: 'cd-actions' },
          clock === '' ? null : h('span', { className: 'cd-time' }, clock),
          message.role === 'assistant' && message.text
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'cd-act' + (speakingId === message.id ? ' cd-act-on' : ''),
                  title: speakingId === message.id ? t('action.stopReading') : t('action.readAloud'),
                  'aria-label': speakingId === message.id ? t('action.stopReading') : t('action.readAloud'),
                  onClick: function () {
                    speak(message);
                  },
                },
                h(Icon, { name: speakingId === message.id ? 'stop' : 'volume', size: 16 }),
              )
            : null,
          message.role === 'assistant' && message.text
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'cd-act',
                  title: t('action.fork'),
                  'aria-label': t('action.fork'),
                  onClick: function () {
                    forkThread(message.id);
                  },
                },
                h(Icon, { name: 'fork', size: 16 }),
              )
            : null,
          message.role === 'user' && message.text
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'cd-act',
                  title: t('action.edit'),
                  'aria-label': t('action.edit'),
                  onClick: function () {
                    setEditTarget({ id: message.id, text: message.text });
                  },
                },
                h(Icon, { name: 'pencil', size: 16 }),
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              className: 'cd-act',
              title: copiedId === message.id ? t('action.copied') : t('action.copy'),
              'aria-label': t('action.copy'),
              onClick: function () {
                copy(message);
              },
            },
            h(Icon, { name: copiedId === message.id ? 'check' : 'copy', size: 16 }),
          ),
          extra || null,
        );
      };

      const renderSearch = function (message) {
        const state = message.search;
        if (!state) return null;
        if (state.phase === 'start') {
          return h('div', { className: 'cd-search' }, h(Icon, { name: 'globe', size: 13 }), h('span', null, t('search.running')));
        }
        if (state.phase === 'error') {
          return h(
            'div',
            { className: 'cd-search' },
            h(Icon, { name: 'globe', size: 13 }),
            h('span', null, state.message || t('search.failed')),
          );
        }
        const sources = state.sources || [];
        if (sources.length === 0) return null;
        return h(
          'details',
          { className: 'cd-sources' },
          h(
            'summary',
            null,
            h(Icon, { name: 'globe', size: 13 }),
            h('span', null, t('search.count').replace('{count}', String(sources.length))),
          ),
          h(
            'div',
            { className: 'cd-source-list' },
            sources.map(function (source, index) {
              return h(
                'a',
                {
                  key: index,
                  className: 'cd-source',
                  href: source.url,
                  target: '_blank',
                  rel: 'noreferrer',
                  title: source.url,
                },
                h('span', null, source.title || source.url),
              );
            }),
          ),
        );
      };

      /** 命中消息的强调类；当前命中再多一个 active。 */
      const hitClass = function (message) {
        if (!findOpen || findNeedle === '') return '';
        if (typeof message.text !== 'string' || message.text.toLowerCase().indexOf(findNeedle.toLowerCase()) < 0) return '';
        return findMatches[findActive] === message ? ' cd-hit cd-hit-active' : ' cd-hit';
      };

      const renderFindBar = function () {
        const total = findMatches.length;
        const focusInput = function () {
          setTimeout(function () {
            const input = findInputRef.current;
            if (input && input.focus) input.focus();
          }, 0);
        };
        return h(
          'div',
          { className: 'cd-find', role: 'search' },
          h(Icon, { name: 'search', size: 15 }),
          h('input', {
            ref: findInputRef,
            className: 'cd-find-input',
            value: findQuery,
            placeholder: t('find.placeholder'),
            'aria-label': t('find.placeholder'),
            onChange: function (event) {
              setFindQuery(event.target.value);
              setFindIndex(0);
            },
            onKeyDown: function (event) {
              if (event.key === 'Enter') {
                event.preventDefault();
                stepFind(event.shiftKey ? -1 : 1);
                return;
              }
              if (event.key === 'Escape') {
                event.stopPropagation();
                closeFind();
              }
            },
          }),
          h('span', { className: 'cd-find-count' }, total === 0 ? t('find.none') : findActive + 1 + '/' + total),
          h(
            'button',
            {
              type: 'button',
              className: 'cd-iconbtn cd-iconbtn-sm',
              title: t('find.prev'),
              'aria-label': t('find.prev'),
              disabled: total === 0,
              onClick: function () {
                stepFind(-1);
                focusInput();
              },
            },
            h(Icon, { name: 'chevronUp', size: 16 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'cd-iconbtn cd-iconbtn-sm',
              title: t('find.next'),
              'aria-label': t('find.next'),
              disabled: total === 0,
              onClick: function () {
                stepFind(1);
                focusInput();
              },
            },
            h(Icon, { name: 'chevronDown', size: 16 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'cd-iconbtn cd-iconbtn-sm',
              title: t('find.close'),
              'aria-label': t('find.close'),
              onClick: closeFind,
            },
            h(Icon, { name: 'x', size: 16 }),
          ),
        );
      };

      /** 把 provider/model 解析成展示名；目录里没有时退回 id。 */
      const modelName = function (selection) {
        if (!selection) return t('model.default');
        const provider = modelCatalog.providers.find(function (entry) {
          return entry.id === selection.provider;
        });
        const model =
          provider && Array.isArray(provider.models)
            ? provider.models.find(function (item) {
                return item.id === selection.model;
              })
            : null;
        return model && model.name ? model.name : selection.model;
      };

      const pickModel = function (choice) {
        setModelChoice(choice);
        saveModelChoice(choice);
        setModelMenu(false);
      };

      const renderModelMenu = function () {
        const rows = [];
        rows.push(
          h(
            'button',
            {
              key: 'auto',
              type: 'button',
              role: 'menuitemradio',
              'aria-checked': modelChoice === null ? 'true' : 'false',
              className: 'cd-session-menu-item',
              onClick: function () {
                pickModel(null);
              },
            },
            h(Icon, { name: 'sparkle', size: 15 }),
            h('span', { className: 'cd-model-name' }, t('model.followDefault')),
            modelChoice === null ? h(Icon, { name: 'check', size: 15 }) : null,
          ),
        );
        modelCatalog.providers.forEach(function (provider) {
          if (!Array.isArray(provider.models) || provider.models.length === 0) return;
          rows.push(h('div', { key: 'p-' + provider.id, className: 'cd-model-group' }, provider.name || provider.id));
          provider.models.forEach(function (model) {
            const active = modelChoice !== null && modelChoice.provider === provider.id && modelChoice.model === model.id;
            rows.push(
              h(
                'button',
                {
                  key: 'm-' + provider.id + '-' + model.id,
                  type: 'button',
                  role: 'menuitemradio',
                  'aria-checked': active ? 'true' : 'false',
                  className: 'cd-session-menu-item',
                  onClick: function () {
                    pickModel({ provider: provider.id, model: model.id });
                  },
                },
                h('span', { className: 'cd-model-name' }, model.name),
                active ? h(Icon, { name: 'check', size: 15 }) : null,
              ),
            );
          });
        });
        return h(
          'div',
          { className: 'cd-model-layer' },
          h('div', {
            className: 'cd-model-mask',
            onClick: function () {
              setModelMenu(false);
            },
          }),
          h('div', { className: 'cd-model-menu', role: 'menu', 'aria-label': t('model.pick') }, rows),
        );
      };

      /**
       * 用量明细：本轮 token 拆分与上下文占用。只展示确切数字与一条近似说明，
       * 不虚构 system / tools 分段。
       */
      const renderUsagePanel = function () {
        if (usagePanel === null) return null;
        const title = usagePanel === 'turn' ? t('usage.panelTurn') : t('usage.panelContext');
        const close = function () {
          setUsagePanel(null);
        };
        let body = null;
        if (usagePanel === 'turn' && activeUsage !== null) {
          const totals = activeUsage.totals;
          const rows = [
            [t('usage.uncached'), formatTokenCount(totals.uncached)],
            [t('usage.cacheRead'), formatTokenCount(totals.cacheRead)],
            [t('usage.cacheWrite'), formatTokenCount(totals.cacheWrite)],
            [
              t('usage.output'),
              formatTokenCount(totals.output) +
                (totals.reasoning > 0 ? '（' + t('usage.reasoning') + ' ' + formatTokenCount(totals.reasoning) + '）' : ''),
            ],
            [t('usage.cacheHit'), totals.cacheHit === null ? '—' : totals.cacheHit + '%'],
            [t('usage.total'), formatTokenCount(totals.input + totals.output)],
          ];
          body = h(
            'dl',
            { className: 'cd-usage-rows' },
            rows.map(function (row, index) {
              return h(
                'div',
                { key: index, className: 'cd-usage-row' },
                h('dt', null, row[0]),
                h('dd', null, row[1]),
              );
            }),
          );
        } else if (usagePanel === 'context' && occupancy !== null) {
          const breakdown = activeUsage === null ? null : activeUsage.context;
          const parts =
            breakdown === null
              ? []
              : [
                  { key: 'system', label: t('usage.system'), tokens: breakdown.system },
                  { key: 'messages', label: t('usage.messages'), tokens: breakdown.messages },
                  { key: 'tools', label: t('usage.tools'), tokens: breakdown.tools },
                ];
          const estimateTotal = parts.reduce(function (sum, part) {
            return sum + part.tokens;
          }, 0);
          const segments =
            estimateTotal === 0
              ? []
              : parts
                  .filter(function (part) {
                    return part.tokens > 0;
                  })
                  .map(function (part, index) {
                    return {
                      key: part.key,
                      width: (occupancy.percent * part.tokens) / estimateTotal,
                      opacity: index === 0 ? 0.9 : index === 1 ? 0.55 : 0.3,
                    };
                  });
          body = h(
            'div',
            null,
            h('div', { className: 'cd-usage-percent' }, occupancy.percent + '%'),
            h(
              'div',
              { className: 'cd-usage-bar' },
              segments.length === 0
                ? h('span', { style: { width: occupancy.percent + '%' } })
                : segments.map(function (segment) {
                    return h('span', {
                      key: segment.key,
                      className: 'cd-usage-seg',
                      style: { width: segment.width + '%', opacity: segment.opacity },
                    });
                  }),
            ),
            h(
              'div',
              { className: 'cd-usage-figures' },
              '~' + formatTokenCount(occupancy.used) + ' / ' + formatTokenCount(occupancy.window),
            ),
            parts.length === 0
              ? null
              : h(
                  'dl',
                  { className: 'cd-usage-rows' },
                  parts.map(function (part) {
                    return h(
                      'div',
                      { key: part.key, className: 'cd-usage-row' },
                      h('dt', null, part.label),
                      h('dd', null, '~' + formatTokenCount(part.tokens)),
                    );
                  }),
                ),
            h(
              'div',
              { className: 'cd-usage-note' },
              t('usage.remaining').replace('{tokens}', formatTokenCount(Math.max(0, occupancy.window - occupancy.used))),
            ),
            h('div', { className: 'cd-usage-note' }, t('usage.approx')),
          );
        }
        return h(
          'div',
          { className: 'cd-usage-layer' },
          h('div', { className: 'cd-usage-mask', onClick: close }),
          h(
            'div',
            { className: 'cd-usage-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
            h(
              'div',
              { className: 'cd-usage-head' },
              h('span', { className: 'cd-usage-title' }, title),
              h(
                'button',
                {
                  type: 'button',
                  className: 'cd-iconbtn cd-iconbtn-sm',
                  title: t('usage.close'),
                  'aria-label': t('usage.close'),
                  onClick: close,
                },
                h(Icon, { name: 'x', size: 15 }),
              ),
            ),
            body,
          ),
        );
      };

      const renderThread = function () {
        if (!activeThread) return null;
        const messages = activeThread.messages;
        const last = messages[messages.length - 1];
        return h(
          'div',
          { className: 'cd-column' },
          messages.map(function (message) {
            if (message.role === 'user') {
              return h(
                'div',
                { key: message.id, className: 'cd-user' + hitClass(message), 'data-mid': message.id },
                message.files && message.files.length > 0
                  ? h(
                      'div',
                      { className: 'cd-user-files' },
                      message.files.map(function (file, index) {
                        return h(
                          'span',
                          { key: index, className: 'cd-chip cd-chip-static' },
                          h(Icon, { name: 'file', size: 13 }),
                          h('span', { className: 'cd-chip-name' }, file.name),
                        );
                      }),
                    )
                  : null,
                message.images && message.images.length > 0
                  ? h(MessageImages, { t: t, images: message.images })
                  : null,
                message.text
                  ? h(
                      'div',
                      { className: 'cd-bubble' },
                      hitClass(message) === '' ? message.text : highlightText(message.text, findNeedle, 'u'),
                    )
                  : null,
                renderActions(message),
              );
            }
            const streaming = pending && last && last.id === message.id;
            const waiting = streaming && message.text === '' && !message.reasoning && !message.search;
            const turnUsage = usageTotals(message.usage);
            return h(
              'div',
              { key: message.id, className: 'cd-assistant' + hitClass(message), 'data-mid': message.id },
              renderSearch(message),
              message.reasoning
                ? h(
                    'details',
                    {
                      className: 'cd-think',
                      ...(streaming && message.text === '' ? { open: true } : {}),
                    },
                    h(
                      'summary',
                      null,
                      h(Icon, { name: 'sparkle', size: 13 }),
                      h('span', null, streaming && message.text === '' ? t('thinking.running') : t('thinking.done')),
                    ),
                    h('div', { className: 'cd-think-body' }, message.reasoning),
                  )
                : null,
              waiting
                ? h('div', { className: 'cd-waiting' }, h('i', null), h('i', null), h('i', null))
                : message.text
                  ? h(Markdown, {
                      text: message.text,
                      highlight: hitClass(message) === '' ? '' : findNeedle,
                    })
                  : null,
              message.images && message.images.length > 0
                ? h(MessageImages, { t: t, images: message.images, align: 'start' })
                : null,
              message.error
                ? h(
                    'div',
                    { className: 'cd-error' },
                    h(Icon, { name: 'alert', size: 15 }),
                    h('span', null, t('error.prefix') + message.error),
                    streaming || pending
                      ? null
                      : h(
                          'button',
                          {
                            type: 'button',
                            className: 'cd-retry',
                            onClick: regenerate,
                          },
                          t('action.retry'),
                        ),
                  )
                : null,
              message.stopped ? h('div', { className: 'cd-stopped' }, t('stopped')) : null,
              turnUsage === null
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      className: 'cd-turn-usage',
                      'aria-haspopup': 'dialog',
                      title:
                        t('usage.input') + ' ' + formatTokenCount(turnUsage.input) +
                        (turnUsage.cacheHit === null ? '' : ' · ' + t('usage.cacheHit') + ' ' + turnUsage.cacheHit + '%') +
                        ' · ' + t('usage.output') + ' ' + formatTokenCount(turnUsage.output) +
                        (turnUsage.reasoning > 0
                          ? ' · ' + t('usage.reasoning') + ' ' + formatTokenCount(turnUsage.reasoning)
                          : ''),
                      onClick: function () {
                        setUsagePanel('turn');
                      },
                    },
                    '↑ ' + formatTokenCount(turnUsage.input) + ' · ↓ ' + formatTokenCount(turnUsage.output),
                  ),
              streaming || message.error
                ? null
                : renderActions(
                    message,
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'cd-act',
                        title: t('action.regenerate'),
                        'aria-label': t('action.regenerate'),
                        onClick: regenerate,
                      },
                      h(Icon, { name: 'refresh', size: 16 }),
                    ),
                  ),
            );
          }),
        );
      };

      const siderProps = {
        t: t,
        threads: threads,
        activeId: activeId,
        onSelect: select,
        onNew: startNew,
        onRename: function (thread) {
          setRenameTarget({ id: thread.id, title: thread.title });
        },
        onTogglePin: function (thread) {
          togglePin(thread.id);
        },
        onMulti: function (thread) {
          enterSelect(thread.id);
        },
        onDelete: function (thread) {
          requestDelete([thread.id]);
        },
        onExportOne: function (thread) {
          exportThreadById(thread.id, 'json');
        },
        onExportMarkdown: function (thread) {
          exportThreadById(thread.id, 'markdown');
        },
        selecting: selecting,
        selected: selectedIds,
        onToggleSelect: toggleSelect,
        onExitSelect: exitSelect,
        onSetSelection: setSelectedIds,
        onBulkPin: pinSelected,
        onBulkExport: exportSelected,
        onBulkDelete: requestDeleteSelected,
        onCollapse: function () {
          setSidebarOpen(false);
        },
        onOpenSettings: function () {
          setSettingsOpen(true);
          closeDrawer();
        },
        onCloseDrawer: closeDrawer,
      };

      return h(
        'section',
        {
          className: 'cd-page',
          'aria-label': t('panel.label'),
          style: { '--cd-text-size': FONT_SIZES[fontSize] || FONT_SIZES.standard },
        },
        h('style', null, CSS),
        wide
          ? h(
              'div',
              {
                className: 'cd-sider-wrap' + (sidebarOpen ? ' cd-sider-wrap-open' : ''),
                'aria-hidden': sidebarOpen ? undefined : 'true',
                ...(sidebarOpen ? {} : { inert: true }),
              },
              h(Sider, siderProps),
            )
          : null,
        h(
          'div',
          { className: 'cd-main' },
          h(
            'div',
            { className: 'cd-pill' },
            h(
              'button',
              {
                type: 'button',
                className:
                  'cd-iconbtn cd-iconbtn-lg cd-pill-slot' +
                  (sidebarVisible ? ' cd-pill-slot-off' : ''),
                title: t('action.expand'),
                'aria-label': t('action.expand'),
                'aria-hidden': sidebarVisible ? 'true' : 'false',
                tabIndex: sidebarVisible ? -1 : 0,
                onClick: function () {
                  if (wide) setSidebarOpen(true);
                  else openDrawer();
                },
              },
              h(Icon, { name: 'menu', size: 22, strokeWidth: 2 }),
            ),
            h(
              'button',
              {
                type: 'button',
                className:
                  'cd-iconbtn cd-iconbtn-lg cd-pill-slot' +
                  (hasMessages ? '' : ' cd-pill-slot-off'),
                title: t('find.open'),
                'aria-label': t('find.open'),
                'aria-hidden': hasMessages ? 'false' : 'true',
                tabIndex: hasMessages ? 0 : -1,
                onClick: openFind,
              },
              h(Icon, { name: 'search', size: 22, strokeWidth: 2 }),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'cd-iconbtn cd-iconbtn-lg' + (autoRead ? ' cd-auto-read-on' : ''),
                title: t('settings.autoRead'),
                'aria-label': t('settings.autoRead'),
                'aria-pressed': autoRead ? 'true' : 'false',
                onClick: toggleAutoRead,
              },
              h(Icon, { name: autoRead ? 'volume' : 'volumeOff', size: 22, strokeWidth: 2 }),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'cd-iconbtn cd-iconbtn-lg',
                title: t('action.newChat'),
                'aria-label': t('action.newChat'),
                onClick: startNew,
              },
              h(Icon, { name: 'plus', size: 22, strokeWidth: 2 }),
            ),
          ),
          h(
            'header',
            { className: 'cd-header' + (collapsed ? ' cd-header-pill' : '') },
            h(
              'button',
              {
                type: 'button',
                className: 'cd-header-title',
                title: activeThread ? activeThread.title : t('action.newChat'),
                onClick: function () {
                  if (wide && sidebarOpen) return;
                  if (wide) setSidebarOpen(true);
                  else openDrawer();
                },
              },
              activeThread ? activeThread.title : t('app.name'),
            ),
            h('span', { className: 'cd-header-spacer' }),
          ),
          h(
            'div',
            {
              className: 'cd-body',
              ref: bodyRef,
              onScroll: function (event) {
                const element = event && event.currentTarget ? event.currentTarget : bodyRef.current;
                syncJumpButton(element);
              },
            },
            findOpen ? renderFindBar() : null,
            hasMessages
              ? renderThread()
              : h('div', { className: 'cd-welcome' }, h('div', { className: 'cd-greeting' }, t('greeting'))),
          ),
          h(
            'div',
            { className: 'cd-input-area' },
            hasMessages
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'cd-jump' + (showJump ? ' cd-jump-on' : ''),
                    title: t('action.jumpBottom'),
                    'aria-label': t('action.jumpBottom'),
                    'aria-hidden': showJump ? 'false' : 'true',
                    tabIndex: showJump ? 0 : -1,
                    onClick: jumpToBottom,
                  },
                  h(Icon, { name: 'chevronDown', size: 22, strokeWidth: 2 }),
                )
              : null,
            usagePanel === null ? null : renderUsagePanel(),
            modelMenu ? renderModelMenu() : null,
            undoDelete !== null
              ? h(
                  'div',
                  { className: 'cd-toast cd-undo-toast', role: 'status' },
                  h(
                    'span',
                    null,
                    t('toast.deleted').replace('{count}', String(undoDelete.threads.length)),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'cd-undo-btn', onClick: undoDeleteNow },
                    t('toast.undo'),
                  ),
                )
              : toast
                ? h('div', { className: 'cd-toast', role: 'status' }, toast)
                : null,
            h(
              'div',
              { className: 'cd-input-box' },
              h(Composer, {
                t: t,
                value: draft,
                onChange: setDraft,
                onSend: send,
                onStop: stop,
                pending: pending,
                thinking: thinking,
                search: search,
                onToggleThinking: function () {
                  setThinking(!thinking);
                },
                onToggleSearch: function () {
                  setSearch(!search);
                },
                modelLabel: modelName(modelChoice || modelCatalog.current),
                onOpenModel: function () {
                  setModelMenu(true);
                  loadModels();
                },
                contextOccupancy: occupancy,
                onOpenUsage: function (kind) {
                  setUsagePanel(kind);
                },
                home: !hasMessages,
                textareaRef: textareaRef,
                attachments: attachments,
                onPickFiles: pickFiles,
                onRemoveFile: removeFile,
                onVoice: toggleVoice,
                recording: recording,
                transcribing: transcribing,
              }),
            ),
            h('div', { className: 'cd-caveat' }, transcribing ? t('transcribing') : t('caveat')),
          ),
        ),
        !wide && (drawerOpen || drawerClosing)
          ? h(
              'div',
              { className: 'cd-drawer-root' + (drawerClosing ? ' cd-drawer-leaving' : '') },
              h('div', {
                className: 'cd-mask',
                onClick: closeDrawer,
              }),
              h('div', { className: 'cd-drawer' }, h(Sider, Object.assign({}, siderProps, { mobile: true }))),
            )
          : null,
        settingsOpen
          ? h(SettingsDialog, {
              t: t,
              themeService: getTheme ? getTheme() : null,
              localeService: localeService,
              threadCount: threads.length,
              onClose: function () {
                setSettingsOpen(false);
              },
              exportDir: exportDir,
              voice: ttsVoice,
              onVoiceChange: changeVoice,
              fontSize: fontSize,
              onFontSizeChange: changeFontSize,
              onImport: importConversations,
              onExport: exportConversations,
              onExportOfficial: exportOfficial,
              onListDirectory: listDirectory,
              onChooseDir: chooseExportDir,
              onDeleteAll: deleteAllConversations,
            })
          : null,
        renameTarget === null
          ? null
          : h(RenameDialog, {
              t: t,
              initial: renameTarget.title,
              onCancel: function () {
                setRenameTarget(null);
              },
              onSave: function (title) {
                renameThread(renameTarget.id, title);
                setRenameTarget(null);
              },
            }),
        deleteTarget === null
          ? null
          : h(DeleteDialog, {
              t: t,
              count: deleteTarget.ids.length,
              onCancel: function () {
                setDeleteTarget(null);
              },
              onConfirm: confirmDelete,
            }),
        editTarget === null
          ? null
          : h(EditDialog, {
              t: t,
              initial: editTarget.text,
              onCancel: function () {
                setEditTarget(null);
              },
              onSave: function (text) {
                const target = editTarget;
                setEditTarget(null);
                applyEdit(target.id, text);
              },
            }),
      );
    }

    /** Fold attached file text into the one user turn the model receives. */
    async function composeMessageText(message) {
      const text = typeof message.text === 'string' ? message.text : '';
      const parts = [];
      if (message.images && message.images.length > 0) {
        parts.push('【图片】' + message.images.map(function (image) { return image.name; }).join('、'));
      }
      for (const file of Array.isArray(message.files) ? message.files : []) {
        let content = typeof file.text === 'string' ? file.text : '';
        if (content === '' && typeof file.fileId === 'string') {
          const stored = await getStoredFileText(file.fileId);
          if (typeof stored === 'string') content = stored;
        }
        if (content.length > REQUEST_TEXT_LIMIT) {
          content = content.slice(0, REQUEST_TEXT_LIMIT) + '\n…（已截断，完整文件保留在本地）';
        }
        parts.push(content === '' ? `【附件：${file.name}】（内容保存在本地）` : `【附件：${file.name}】\n${content}\n【附件结束】`);
      }
      if (text !== '') parts.push(text);
      return parts.join('\n\n');
    }

    /* -------------------------------------------------------------------- css */

    const CSS = `
.cd-page{--cd-maxw:840px;--cd-pad:44px;--cd-text-size:16px;--cd-line:calc(var(--cd-text-size) * 1.5);position:relative;box-sizing:border-box;display:flex;width:100%;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:16px;line-height:1.5}
@media (max-width:1023px){.cd-page{--cd-maxw:712px;--cd-pad:36px}}

.cd-sider{box-sizing:border-box;display:flex;flex-direction:column;flex-shrink:0;width:261px;height:100%;padding:6px 12px 0;border-right:1px solid var(--dsw-alias-border-l1);background-color:var(--dsw-specific-sidebar-fill)}
.cd-sider-wrap{flex:0 0 auto;width:0;height:100%;overflow:hidden;transition:width .28s linear}
.cd-sider-wrap-open{width:261px}
.cd-sider-mobile{width:300px;max-width:calc(100vw - 48px);box-shadow:0 12px 32px rgba(0,0,0,.18)}
.cd-sider-top{box-sizing:border-box;display:flex;flex-shrink:0;align-items:center;justify-content:space-between;gap:8px;height:48px;margin-bottom:16px;padding:15px 0 10px 4px}
.cd-brand{display:flex;align-items:center;gap:6px;min-width:0;color:var(--dsw-alias-brand-primary)}
.cd-appname{overflow:hidden;padding-left:4px;color:var(--dsw-alias-brand-primary);font-size:20px;font-weight:600;line-height:22px;white-space:nowrap;text-overflow:ellipsis}
.cd-newchat{box-sizing:border-box;display:flex;flex-shrink:0;align-items:center;justify-content:center;width:100%;height:40px;padding:0 16px;border:1px solid rgba(103,158,254,0);border-radius:100px;background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;user-select:none;box-shadow:0 -2px 2px rgba(72,104,178,.04),0 2px 2px rgba(106,111,117,.09),0 1px 2px rgba(72,104,178,.08);transition:box-shadow .3s}
.cd-newchat:hover{box-shadow:0 4px 4px rgba(72,104,178,.04),0 -3px 4px rgba(72,104,178,.04),0 6px 6px rgba(106,111,117,.1)}
.cd-newchat:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
[data-ds-dark-theme] .cd-newchat{border:none;box-shadow:inset 0 1px 1px rgba(255,255,255,.1),0 2px 4px rgba(106,111,117,.08)}
.cd-newchat-icon{display:flex;margin-right:6px}
.cd-filter{display:flex;flex-shrink:0;align-items:center;gap:6px;height:34px;margin-top:10px;padding:0 8px 0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}
.cd-filter:focus-within{border-color:var(--dsw-alias-brand-primary)}
.cd-filter-input{flex:1;min-width:0;height:100%;padding:0;border:none;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font:13px/20px var(--dsw-font-family)}
.cd-filter-input::placeholder{color:var(--dsw-alias-label-caption)}
.cd-filter-input::-webkit-search-cancel-button{display:none}
.cd-filter-clear{display:flex;flex-shrink:0;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.cd-filter-clear:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.cd-listwrap{position:relative;flex:1;min-height:0;margin-top:24px}
.cd-list{height:100%;margin:0 -2px;padding:0 2px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
.cd-section{position:relative;margin-top:16px;padding-top:4px}
.cd-section:first-child{margin-top:0}
.cd-section-header{position:sticky;top:0;z-index:20;padding:2px 10px;background-color:var(--dsw-specific-sidebar-fill);color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:500;line-height:18px;user-select:none}
.cd-item{box-sizing:border-box;position:relative;display:flex;align-items:center;height:40px;padding:9px 6px 9px 10px;border-radius:12px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px;cursor:pointer;content-visibility:auto;contain-intrinsic-size:auto 40px}
.cd-item-active{background-color:var(--dsw-specific-sidebar-nav-item-active-accent);color:var(--dsw-alias-brand-primary-invert)}
@media (hover:hover){.cd-item:not(.cd-item-active):hover{background-color:var(--dsw-specific-sidebar-nav-item-hover)}}
.cd-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.cd-item-title{flex:1;min-width:0;overflow:hidden;line-height:18px;white-space:nowrap;text-overflow:ellipsis}
.cd-item-menu{display:flex;flex-shrink:0;align-items:center;justify-content:center;width:24px;height:24px;margin-left:4px;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;opacity:.72;transition:opacity .15s,background-color .15s,color .15s}
.cd-item:hover .cd-item-menu,.cd-item-active .cd-item-menu{opacity:1;color:var(--dsw-alias-label-secondary)}
.cd-item-menu:hover{background-color:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.cd-item-menu:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.cd-item-selecting{cursor:pointer}
@media (hover:hover){.cd-item-selecting:hover{background-color:var(--dsw-alias-interactive-bg-hover)}}
.cd-item-checked,.cd-item-checked:hover{background-color:var(--dsw-alias-button-ghost-active-fill)}
.cd-check{display:flex;flex-shrink:0;align-items:center;justify-content:center;width:16px;height:16px;margin-right:8px;border:1.5px solid var(--dsw-alias-border-l2);border-radius:50%;color:var(--dsw-static-neutral-bluish-00,#fff);transition:background-color .15s,border-color .15s}
.cd-check-on{border-color:var(--dsw-alias-brand-primary);background-color:var(--dsw-alias-brand-primary)}
.cd-multibar{display:flex;flex-shrink:0;flex-direction:column;gap:8px;padding:10px 10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-2)}
.cd-multibar-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cd-multibar-tools{display:flex;flex-shrink:0;align-items:center;gap:8px}
.cd-multibar-count{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.cd-multibar-actions{display:flex;gap:8px}
.cd-multibar-btn{box-sizing:border-box;display:inline-flex;flex:1;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:18px;white-space:nowrap;cursor:pointer;transition:background-color .15s}
.cd-multibar-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.cd-multibar-btn:disabled{opacity:.45;cursor:not-allowed}
.cd-multibar-danger{color:var(--dsw-alias-state-error-primary)}
.cd-multibar-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.cd-session-menu{position:absolute;z-index:35;box-sizing:border-box;width:176px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 44px rgba(0,0,0,.2);transform-origin:top right;animation:cd-menu-in .18s cubic-bezier(.32,.72,0,1) both}
.cd-session-menu-up{transform-origin:bottom right}
.cd-session-menu-item{display:flex;align-items:center;gap:10px;width:100%;height:34px;padding:0 8px;border:none;border-radius:9px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer;white-space:nowrap}
.cd-session-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}
.cd-session-menu-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.cd-session-menu-item>span{overflow:hidden;text-overflow:ellipsis}
.cd-session-menu-sep{height:1px;margin:5px 6px;background:var(--dsw-alias-border-l1)}
.cd-session-menu-danger{color:var(--dsw-alias-state-error-primary)}
.cd-session-menu-danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger)}
.cd-list-empty{padding:16px 10px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.cd-sider-bottom{display:flex;flex-shrink:0;height:64px}
.cd-settings{box-sizing:border-box;display:flex;align-items:center;width:100%;margin:auto 0;padding:6px 2px 6px 6px;border:none;border-radius:12px;background:transparent;color:inherit;font-family:inherit;text-align:left;cursor:pointer;user-select:none}
.cd-settings:hover{background-color:var(--dsw-specific-sidebar-nav-item-hover)}
.cd-settings:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-alias-brand-primary)}
.cd-settings-icon{display:flex;flex-shrink:0;align-items:center;justify-content:center;width:32px;height:32px;color:var(--dsw-alias-label-primary)}
.cd-settings-label{overflow:hidden;margin-left:4px;color:var(--dsw-alias-label-primary);font-size:14px;white-space:nowrap;text-overflow:ellipsis}

.cd-sider-mobile .cd-listwrap{margin-top:16px}
.cd-sider-mobile .cd-filter{height:38px;margin-top:14px}
.cd-sider-mobile .cd-filter-input{font-size:15px}
.cd-sider-mobile .cd-section-header{padding:4px 10px 3px;font-size:14px;line-height:22px}
.cd-sider-mobile .cd-item{height:44px;padding:11px 6px 11px 12px;border-radius:16px;font-size:16px}
.cd-sider-mobile .cd-item-title{line-height:22px}
.cd-sider-mobile .cd-sider-bottom{height:auto;padding:12px 0}
.cd-sider-mobile .cd-settings{padding:9px 10px}
.cd-sider-mobile .cd-settings-icon{width:auto;height:auto}
.cd-sider-mobile .cd-settings-label{margin-left:10px;font-size:16px;line-height:22px}

.cd-main{position:relative;box-sizing:border-box;display:flex;flex:1;flex-direction:column;min-width:0;min-height:0}
.cd-header{box-sizing:border-box;display:flex;flex-shrink:0;align-items:center;height:60px;padding:12px 150px 0 10px;background:var(--dsw-alias-bg-base)}
.cd-header-pill{padding-right:188px}
@media (max-width:767px){.cd-header-pill{padding-left:64px}}
.cd-header-title{max-width:480px;overflow:hidden;padding:8px 12px;border:none;border-radius:10px;background:transparent;font:500 14px/22px var(--dsw-font-family);color:var(--dsw-alias-label-primary);white-space:nowrap;text-overflow:ellipsis;cursor:pointer;text-align:left}
.cd-header-title:hover{background:var(--dsw-alias-interactive-bg-hover)}
.cd-header-spacer{flex:1;min-width:0}
.cd-auto-read-on{color:var(--dsw-alias-brand-text)}
.cd-act-on{color:var(--dsw-alias-brand-text)}
.cd-pill{position:absolute;top:12px;right:16px;z-index:20;display:flex;align-items:center;gap:2px;height:48px;padding:0 4px;border:1px solid var(--dsw-alias-border-l2);border-radius:100px;background:var(--dsw-alias-bg-layer-3);box-shadow:0 4px 12px rgba(0,0,0,.04)}
/* 展开侧栏时左侧「边栏」按钮横向线性收起，胶囊随之变窄 */
/* 胶囊里可增减的按钮：横向线性收起/展开（侧栏开关、查找） */
.cd-pill .cd-pill-slot{overflow:hidden;transition:width .28s linear,opacity .28s linear,margin-right .28s linear}
.cd-pill .cd-pill-slot-off{width:0;margin-right:-2px;opacity:0;pointer-events:none}
.cd-body{display:flex;flex:1;flex-direction:column;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
.cd-column{box-sizing:border-box;width:calc(var(--cd-maxw) - 2 * var(--cd-pad));max-width:calc(100% - 40px);margin:0 auto;padding-bottom:24px}
.cd-welcome{box-sizing:border-box;display:flex;flex:1;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 16px}
@media (min-width:768px){.cd-welcome{justify-content:center;padding:0 32px 64px}}
.cd-greeting{display:flex;align-items:center;justify-content:center;margin-bottom:21px;color:var(--dsw-alias-label-primary);font-size:24px;font-weight:600;line-height:32px;text-align:center}
@media (max-width:439px){.cd-greeting{font-size:20px;font-weight:500;line-height:28px}}

.cd-user{display:flex;flex-direction:column;align-items:flex-end;padding-bottom:16px}
.cd-user:first-child{padding-top:34px}
.cd-user-files{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-bottom:8px;max-width:100%}
.cd-user-images{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-bottom:8px;max-width:100%}
.cd-images-start{justify-content:flex-start}
.cd-img-btn{max-width:220px;padding:0;border:none;border-radius:12px;background:transparent;line-height:0;cursor:pointer;overflow:hidden}
.cd-img-thumb{display:block;max-width:220px;max-height:220px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;object-fit:cover}
.cd-img-fallback{display:inline-flex;padding:8px 10px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;color:var(--dsw-alias-label-tertiary);font-size:12px}
.cd-chip-image{padding-left:4px}
.cd-chip-thumb{width:22px;height:22px;border-radius:6px;object-fit:cover}
.cd-lightbox{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:32px;background:rgba(0,0,0,.72)}
.cd-lightbox-img{max-width:min(92vw,1200px);max-height:86vh;border-radius:12px;box-shadow:0 24px 64px rgba(0,0,0,.4)}
.cd-lightbox-close{position:absolute;top:18px;right:18px;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border:none;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;cursor:pointer}
.cd-lightbox-close:hover{background:rgba(255,255,255,.24)}
.cd-bubble{box-sizing:border-box;max-width:calc(100% - 88px);padding:10px 16px;border-radius:22px;background-color:var(--dsw-specific-bubble);color:var(--dsw-alias-label-primary);font-size:var(--cd-text-size);line-height:1.5;white-space:pre-wrap;word-break:break-word}
@media (max-width:439px){.cd-bubble{max-width:calc(100% - 68px)}}
.cd-assistant{padding-bottom:24px}
.cd-actions{display:flex;align-items:center;gap:10px;padding-top:6px;opacity:1}
.cd-assistant .cd-actions{padding-top:12px;padding-bottom:4px}
@media (hover:hover){.cd-actions{opacity:0;transition:opacity .15s}.cd-user:hover .cd-actions,.cd-assistant:hover .cd-actions{opacity:1}}
.cd-act{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;transition:background-color .15s,color .15s}
.cd-time{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;letter-spacing:.02em;user-select:none}
.cd-act:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.cd-act:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.cd-waiting{display:flex;align-items:center;gap:6px;height:34px}
.cd-waiting i{display:block;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-dimmed);animation:cd-fade .9s linear infinite}
.cd-waiting i:nth-child(2){animation-delay:.1s}
.cd-waiting i:nth-child(3){animation-delay:.2s}
@keyframes cd-fade{0%,100%{opacity:.3}50%{opacity:1}}
.cd-think{margin:0 0 10px;padding-left:10px;border-left:2px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:13px;line-height:21px}
.cd-think>summary{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;cursor:pointer;list-style:none;user-select:none}
.cd-think>summary::-webkit-details-marker{display:none}
.cd-think[open]>summary{margin-bottom:6px}
.cd-think-body{white-space:pre-wrap;overflow-wrap:anywhere}
.cd-search{display:flex;align-items:center;gap:6px;margin:0 0 8px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.cd-sources{display:block;margin:0 0 10px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-2)}
.cd-sources>summary{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;cursor:pointer;list-style:none;user-select:none}
.cd-sources>summary::-webkit-details-marker{display:none}
.cd-sources[open]>summary{margin-bottom:6px}
.cd-source-list{display:flex;flex-direction:column;gap:4px}
.cd-source{display:block;overflow:hidden;color:var(--dsw-alias-brand-text);font-size:13px;line-height:20px;text-decoration:none;text-overflow:ellipsis;white-space:nowrap}
.cd-source:hover{text-decoration:underline}
.cd-error{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:6px;color:var(--dsw-alias-state-error-primary);font-size:14px;line-height:22px}
.cd-retry{padding:0;border:none;background:transparent;color:var(--dsw-alias-brand-text);font:inherit;font-size:14px;cursor:pointer;text-decoration:underline}
.cd-stopped{margin-top:6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}

.cd-md{color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:var(--cd-text-size);line-height:1.75;overflow-wrap:anywhere}
.cd-md p{margin:16px 0}
.cd-md>:first-child{margin-top:0}
.cd-md>:last-child{margin-bottom:0}
.cd-md strong{font-weight:600}
.cd-md ul,.cd-md ol{margin:16px 0;padding-left:18px}
.cd-md li:not(:first-child){margin-top:6px}
.cd-md li::marker{color:var(--dsw-alias-label-secondary)}
.cd-md h3{margin:24px 0 12px;font-size:calc(var(--cd-text-size) + 2px);font-weight:600;line-height:calc(var(--cd-text-size) + 10px)}
.cd-md code{padding:2px 5px;border-radius:6px;background:var(--dsw-alias-markdown-inline-code);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,monospace);font-size:calc(var(--cd-text-size) - 3px);line-height:calc(var(--cd-text-size) + 6px)}
.cd-md pre{box-sizing:border-box;margin:16px 0;padding:14px 16px;border-radius:12px;background:var(--dsw-alias-markdown-code-block);overflow-x:auto;overscroll-behavior-inline:contain}
.cd-md pre code{padding:0;background:transparent;font-size:calc(var(--cd-text-size) - 3px);line-height:calc(var(--cd-text-size) + 6px);white-space:pre}

.cd-input-area{position:relative;z-index:10;box-sizing:border-box;display:flex;flex-shrink:0;flex-direction:column;align-items:center;padding-bottom:max(4px,env(safe-area-inset-bottom))}
/* 一键到底：随消息滚动线性淡入/淡出，点击后按 280ms 线性滚回底部 */
.cd-jump{position:absolute;right:max(16px,calc((100% - var(--cd-maxw) + 64px) / 2));bottom:calc(100% + 14px);z-index:20;display:flex;align-items:center;justify-content:center;width:38px;height:38px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:50%;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;transform:translateY(10px) scale(.92);pointer-events:none;transition:opacity .28s linear,transform .28s linear,background-color .2s,color .2s;box-shadow:0 6px 20px rgba(0,0,0,.12)}
.cd-jump-on{opacity:1;transform:none;pointer-events:auto}
.cd-jump:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.cd-jump:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.cd-input-box{width:calc(var(--cd-maxw) - 64px);max-width:calc(100% - 32px)}
.cd-composer{box-sizing:border-box;display:flex;flex-direction:column;width:100%;overflow:hidden;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:24px;background:var(--dsw-specific-input-major);font-size:var(--cd-text-size);line-height:var(--cd-line);cursor:text}
.cd-composer-home{box-shadow:0 4px 12px rgba(0,0,0,.02),0 2px 2px rgba(72,104,178,.01),0 30px 60px rgba(72,104,178,.03)}
.cd-composer-session{box-shadow:0 4px 10px rgba(0,0,0,.02),0 2px 4px rgba(0,0,0,.04)}
[data-ds-dark-theme] .cd-composer-home{box-shadow:none}
.cd-files{display:flex;flex-wrap:wrap;gap:8px;padding:12px 12px 0}
.cd-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;height:28px;padding:0 6px 0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.cd-chip-static{padding-right:8px}
.cd-chip-name{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cd-chip-x{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.cd-chip-x:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.cd-ta-wrap{position:relative;width:100%}
.cd-ta{box-sizing:border-box;display:block;width:100%;min-height:60px;max-height:336px;margin:0;padding:12px 12px 0 16px;border:none;outline:none;background:transparent;color:var(--dsw-alias-label-primary);caret-color:var(--dsw-alias-brand-text);font:inherit;line-height:inherit;resize:none;overflow-y:auto;overscroll-behavior:contain;word-break:break-word;white-space:pre-wrap}
.cd-ta::placeholder{color:var(--dsw-alias-label-caption);user-select:none}
.cd-fn-row{display:flex;align-items:center;gap:8px;margin-top:4px;padding:12px}
.cd-toggles{display:flex;flex:1;align-items:center;gap:10px;min-width:0}
.cd-toggle{display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;width:44px;height:34px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:18px;background-color:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;font-weight:500;line-height:20px;white-space:nowrap;cursor:pointer;user-select:none;transition:border-color .2s,background-color .2s}
.cd-toggle:hover{background-color:var(--dsw-alias-interactive-bg-hover)}
.cd-toggle-on{background-color:var(--dsw-alias-button-ghost-active-fill);border-color:var(--dsw-alias-button-ghost-active-border);color:var(--dsw-alias-brand-text)}
.cd-toggle-on:hover{background-color:var(--dsw-alias-button-ghost-active-hover)}
.cd-toggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.cd-right{display:flex;flex-shrink:0;align-items:center;gap:4px;margin-left:auto}
.cd-file-input{display:none}
.cd-send{display:flex;flex-shrink:0;align-items:center;justify-content:center;width:34px;height:34px;margin-left:6px;padding:0;border:none;border-radius:50%;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-static-neutral-bluish-00,#fff);cursor:pointer;transition:background-color .2s}
.cd-send:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.cd-send:disabled{opacity:.4;cursor:not-allowed}
.cd-send:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
/* 暗色模式：主按钮填充会变成近白色（#f9fafb），图标沿用白色会看不见，改用成对的前景色令牌 */
body[data-ds-dark-theme] .cd-send{color:var(--dsw-alias-label-primary-foreground)}
body[data-ds-dark-theme] .cd-send:disabled{opacity:.55}
.cd-iconbtn{display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;cursor:pointer;transition:background-color .2s,color .2s}
.cd-iconbtn:hover{background-color:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.cd-iconbtn:disabled{opacity:.4;cursor:not-allowed}
.cd-iconbtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.cd-iconbtn-sm{width:32px;height:32px}
.cd-iconbtn-lg{width:38px;height:38px}
.cd-mic-live{color:var(--dsw-alias-state-error-primary);animation:cd-pulse 1.1s ease-in-out infinite}
@keyframes cd-pulse{50%{opacity:.35}}
.cd-caveat{width:100%;padding:6px 0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;text-align:center;user-select:none}
.cd-toast{position:absolute;left:50%;bottom:calc(100% - 24px);transform:translateX(-50%);z-index:30;max-width:min(320px,calc(100% - 32px));padding:8px 12px;border-radius:10px;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base);font-size:13px;line-height:20px;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.18)}
.cd-undo-toast{display:flex;align-items:center;gap:10px;white-space:nowrap}
.cd-undo-btn{padding:0;border:none;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.cd-undo-btn:focus-visible{outline:2px solid currentColor;outline-offset:2px}

.cd-drawer-root{position:absolute;top:0;right:0;bottom:0;left:0;z-index:60}
.cd-mask{position:absolute;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.45);animation:cd-fade .2s linear both}
@keyframes cd-fade{from{opacity:0}to{opacity:1}}
.cd-drawer{position:absolute;top:0;bottom:0;left:0;display:flex;will-change:transform;animation:cd-slide .2s linear both}
@keyframes cd-slide{from{transform:translateX(-100%)}to{transform:translateX(0)}}
.cd-drawer-root.cd-drawer-leaving{pointer-events:none}
.cd-drawer-leaving .cd-drawer{animation:cd-slide-out .2s linear both}
.cd-drawer-leaving .cd-mask{animation:cd-fade-out .2s linear both}
@keyframes cd-slide-out{from{transform:translateX(0)}to{transform:translateX(-100%)}}
@keyframes cd-fade-out{from{opacity:1}to{opacity:0}}

.cd-modal{position:absolute;top:0;right:0;bottom:0;left:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:16px}
.cd-modal-confirm{z-index:90}
.cd-modal-mask{position:absolute;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.3);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.cd-tabs{display:flex;gap:8px;padding:2px 0 14px}
.cd-tab{display:flex;flex:1;align-items:center;justify-content:center;gap:8px;height:46px;border:none;border-radius:12px;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:background-color .15s,color .15s}
.cd-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}
.cd-tab-on{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.cd-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.cd-panes{overflow:hidden;touch-action:pan-y}
.cd-track{display:flex;width:200%;transition:transform .24s linear;will-change:transform}
.cd-pane-slot{flex:0 0 50%;width:50%;min-width:0}
.cd-pane{display:flex;flex-direction:column}
.cd-pane-title{padding:2px 0 10px;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
.cd-settings-update{padding:0;border:0;background:transparent;color:inherit;font:inherit;line-height:inherit;cursor:pointer}
.cd-settings-update:hover:not(:disabled){color:var(--dsw-alias-label-primary);text-decoration:underline}
.cd-settings-update:disabled{cursor:default;opacity:.6}
.cd-theme-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cd-theme-card{box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:92px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px;cursor:pointer;transition:border-color .15s,background-color .15s}
.cd-theme-card:hover{background:var(--dsw-alias-interactive-bg-hover)}
.cd-theme-card-wide{grid-column:1 / -1}
.cd-theme-card-on{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-button-ghost-active-fill);color:var(--dsw-alias-brand-text)}
.cd-theme-label{font-weight:500}
.cd-row-list{display:flex;flex-direction:column;margin-top:14px}
.cd-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-top:1px solid var(--dsw-alias-border-l1)}
.cd-row-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.cd-row-title{color:var(--dsw-alias-label-primary);font-size:15px;line-height:22px}
.cd-row-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.cd-pill-btn{flex-shrink:0;min-width:76px;height:36px;padding:0 18px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;cursor:pointer;transition:background-color .15s,border-color .15s}
.cd-pill-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.cd-pill-btn:disabled{opacity:.45;cursor:not-allowed}
.cd-pill-btn-danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.cd-pill-btn-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.cd-select{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;cursor:pointer}
.cd-select:hover{background:var(--dsw-alias-interactive-bg-hover)}
.cd-menu-layer{position:fixed;top:0;right:0;bottom:0;left:0;z-index:40}
.cd-select-menu{position:fixed;z-index:41;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 44px rgba(0,0,0,.2);transform-origin:top right;animation:cd-menu-in .2s cubic-bezier(.32,.72,0,1) both}
.cd-select-menu-up{transform-origin:bottom right}
@keyframes cd-menu-in{0%{opacity:0;transform:scale(.86) translateY(-8px)}60%{opacity:1}100%{opacity:1;transform:scale(1) translateY(0)}}
.cd-select-item{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;height:34px;padding:0 8px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;text-align:left;cursor:pointer}
.cd-select-item:hover{background:var(--dsw-alias-interactive-bg-hover)}
.cd-select-item-on{color:var(--dsw-alias-brand-text)}
.cd-sheet{position:relative;z-index:1;box-sizing:border-box;display:flex;flex-direction:column;width:100%;max-width:420px;max-height:min(82%,640px);overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-overlay);box-shadow:0 24px 60px rgba(0,0,0,.24)}
.cd-sheet-head{display:flex;flex-shrink:0;align-items:center;justify-content:space-between;gap:8px;padding:14px 12px 6px 18px}
.cd-sheet-title{margin:0;font-size:16px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary)}
.cd-sheet-body{overflow-y:auto;overscroll-behavior:contain;padding:4px 18px 18px}
.cd-settings-foot{display:flex;flex-shrink:0;align-items:center;justify-content:center;gap:6px;padding:10px 18px 14px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.cd-settings-repo{color:var(--dsw-alias-label-tertiary);text-decoration:none}
.cd-settings-repo:hover{color:var(--dsw-alias-brand-text);text-decoration:underline}
.cd-group+.cd-group{margin-top:18px}
.cd-group-title{padding-bottom:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.cd-choices{display:flex;flex-wrap:wrap;gap:8px}
.cd-choice{height:34px;padding:0 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px;cursor:pointer;transition:background-color .15s,border-color .15s}
.cd-choice:hover{background:var(--dsw-alias-interactive-bg-hover)}
.cd-choice-on{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-button-ghost-active-fill);color:var(--dsw-alias-brand-text)}
.cd-choice:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.cd-hint{margin:8px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.cd-confirm{position:relative;z-index:1;box-sizing:border-box;width:100%;max-width:320px;padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-overlay);box-shadow:0 24px 60px rgba(0,0,0,.24)}
.cd-confirm-title{margin:0 0 8px;font-size:16px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary)}
.cd-confirm-text{margin:0;color:var(--dsw-alias-label-secondary);font-size:14px;line-height:22px}
.cd-confirm-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.cd-btn{height:36px;min-width:76px;padding:0 16px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;font-weight:500;cursor:pointer}
.cd-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.cd-btn-danger{border-color:transparent;background:var(--dsw-alias-state-error-primary);color:var(--dsw-static-neutral-bluish-00,#fff)}
.cd-btn-danger:hover{opacity:.9;background:var(--dsw-alias-state-error-primary)}
.cd-dialog{position:relative;z-index:1;box-sizing:border-box;width:100%;max-width:360px;padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-overlay);box-shadow:0 24px 60px rgba(0,0,0,.24)}
.cd-dialog-title{margin:0 0 14px;color:var(--dsw-alias-label-primary);font-size:16px;font-weight:600;line-height:24px}
.cd-dialog-input{box-sizing:border-box;width:100%;height:40px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;outline:none;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:14px/22px var(--dsw-font-family)}
.cd-dialog-input::placeholder{color:var(--dsw-alias-label-caption)}
.cd-dialog-input:focus{border-color:var(--dsw-alias-brand-primary)}
.cd-dialog-textarea{box-sizing:border-box;display:block;width:100%;min-height:120px;max-height:240px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;outline:none;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:14px/22px var(--dsw-font-family);resize:vertical}
.cd-dialog-textarea:focus{border-color:var(--dsw-alias-brand-primary)}
.cd-dialog-hint{margin:8px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.cd-dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
.cd-delete-confirm{max-width:320px;padding:22px 20px 18px}
.cd-delete-title{margin:0;color:var(--dsw-alias-label-primary);font-size:16px;font-weight:600;line-height:24px}
.cd-delete-note{margin:8px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.cd-find{position:sticky;top:8px;z-index:6;display:flex;align-items:center;gap:6px;box-sizing:border-box;width:min(640px,calc(100% - 32px));margin:8px auto 0;padding:5px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);box-shadow:0 8px 24px rgba(0,0,0,.16)}
.cd-find-input{flex:1;min-width:0;border:0;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font:13px/20px var(--dsw-font-family)}
.cd-find-count{color:var(--dsw-alias-label-tertiary);font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums}
mark.cd-mark{padding:0 1px;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 45%,transparent);color:var(--dsw-alias-label-primary);box-shadow:inset 0 -1px 0 color-mix(in srgb,var(--dsw-alias-state-warn-primary) 85%,transparent)}
.cd-hit{scroll-margin-block:96px}
.cd-hit-active mark.cd-mark{background:var(--dsw-alias-state-warn-primary);color:#1f1f1f;box-shadow:none}
.cd-hit-active .cd-bubble{box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-warn-primary) 55%,transparent)}
.cd-model-chip{box-sizing:border-box;display:inline-flex;align-items:center;gap:4px;min-width:0;max-width:210px;height:28px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:12px/16px var(--dsw-font-family);cursor:pointer}
.cd-model-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.cd-model-chip-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cd-model-layer{position:absolute;inset:0;z-index:30;pointer-events:none}
.cd-model-mask{position:fixed;inset:0;pointer-events:auto}
.cd-model-menu{position:absolute;left:10px;bottom:calc(100% - 4px);z-index:31;box-sizing:border-box;display:flex;flex-direction:column;width:250px;max-height:min(420px,72vh);overflow-y:auto;padding:5px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2));box-shadow:0 16px 40px rgba(0,0,0,.28);pointer-events:auto}
.cd-model-group{padding:8px 10px 4px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;letter-spacing:.02em}
.cd-model-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cd-meter{display:inline-flex;flex-shrink:0;align-items:center;gap:4px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:12px/16px var(--dsw-font-family);font-variant-numeric:tabular-nums;cursor:pointer}
.cd-meter:hover{color:var(--dsw-alias-label-secondary)}
.cd-meter svg{display:block;flex-shrink:0}
.cd-turn-usage{display:flex;justify-content:flex-end;align-items:center;margin-top:4px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:12px/16px var(--dsw-font-family);font-variant-numeric:tabular-nums;cursor:pointer}
.cd-turn-usage:hover{color:var(--dsw-alias-label-secondary)}
.cd-usage-layer{position:absolute;inset:0;z-index:32;pointer-events:none}
.cd-usage-mask{position:fixed;inset:0;pointer-events:auto}
.cd-usage-panel{position:absolute;right:10px;bottom:calc(100% - 4px);z-index:33;box-sizing:border-box;width:280px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2));box-shadow:0 16px 40px rgba(0,0,0,.28);pointer-events:auto}
.cd-usage-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.cd-usage-title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:18px}
.cd-usage-rows{display:flex;flex-direction:column;gap:6px;margin:0}
.cd-usage-row{display:flex;justify-content:space-between;gap:12px;margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.cd-usage-row dt{margin:0}
.cd-usage-row dd{margin:0;color:var(--dsw-alias-label-primary)}
.cd-usage-percent{color:var(--dsw-alias-label-primary);font-size:22px;font-weight:600;line-height:28px;font-variant-numeric:tabular-nums}
.cd-usage-bar{height:6px;margin:8px 0;overflow:hidden;border-radius:3px;background:color-mix(in srgb,currentColor 18%,transparent);color:var(--dsw-alias-label-tertiary)}
.cd-usage-bar span{display:block;height:100%;border-radius:3px;background:var(--dsw-alias-label-secondary)}
.cd-usage-bar .cd-usage-seg{background:var(--dsw-alias-label-secondary)}
.cd-usage-figures{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.cd-usage-note{margin-top:6px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.cd-usage{margin-right:2px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
.cd-delete-actions{display:flex;gap:10px;margin-top:22px}
.cd-confirm-pill{display:inline-flex;flex:1;align-items:center;justify-content:center;height:40px;padding:0 14px;border:none;border-radius:999px;font-family:inherit;font-size:14px;font-weight:500;line-height:20px;white-space:nowrap;cursor:pointer;transition:background-color .15s,opacity .15s}
.cd-confirm-pill:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.cd-confirm-pill-cancel{background:#f0f0f0;color:#111}
.cd-confirm-pill-cancel:hover{background:#e4e4e4}
.cd-confirm-pill-danger{background:var(--dsw-alias-state-error-primary);color:var(--dsw-static-neutral-bluish-00,#fff)}
.cd-confirm-pill-danger:hover{opacity:.9}
.cd-fallback{align-items:center;justify-content:center;padding:32px}
.cd-fallback-box{display:flex;flex-direction:column;align-items:center;gap:10px;max-width:420px;text-align:center}
.cd-fallback-title{color:var(--dsw-alias-label-primary);font-size:16px;font-weight:600;line-height:24px}
.cd-fallback-desc{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.cd-fallback-retry{width:auto;min-width:96px;height:36px;padding:0 18px}
.cd-status{margin:10px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.cd-status-error{color:var(--dsw-alias-state-error-primary)}
.cd-browse{display:flex;flex:1;flex-direction:column;min-height:0;padding:0 18px 18px}
.cd-browse-head{display:flex;align-items:center;gap:8px;padding-bottom:10px}
.cd-browse-path{flex:1;min-width:0;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;white-space:nowrap;text-overflow:ellipsis;direction:rtl;text-align:left}
.cd-textbtn{padding:0;border:none;background:transparent;color:var(--dsw-alias-brand-text);font-family:inherit;font-size:13px;cursor:pointer}
.cd-textbtn:disabled{color:var(--dsw-alias-label-caption);cursor:not-allowed}
.cd-browse-quick{display:flex;flex-wrap:wrap;gap:8px;padding-bottom:10px}
.cd-browse-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--dsw-alias-border-l1);border-radius:12px}
.cd-folder{display:flex;align-items:center;gap:8px;width:100%;padding:11px 12px;border:none;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer}
.cd-folder+.cd-folder{border-top:1px solid var(--dsw-alias-border-l1)}
.cd-folder:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.cd-folder:disabled{opacity:.5;cursor:not-allowed}
.cd-folder-name{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.cd-browse-foot{padding-top:12px}
.cd-browse-foot .cd-btn{width:100%}
.cd-btn-primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-static-neutral-bluish-00,#fff)}
.cd-btn-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.cd-btn-primary:disabled{opacity:.5;cursor:not-allowed}
/* 暗色模式的主按钮填充是近白色（brand-primary = neutral-bluish-50），白字看不见，文字改黑色 */
body[data-ds-dark-theme] .cd-btn-primary{color:#000}
`;

    /**
     * 面板级错误边界：渲染异常时只让这一块显示兜底，而不是整页白屏。
     * 对话存在 localStorage 里，重试或切走再回来都不会丢。
     */
    class ChatBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
        this.retry = this.retry.bind(this);
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[deepseek-chat-ui]', error);
        }
      }
      retry() {
        this.setState({ failed: false });
      }
      render() {
        if (!this.state.failed) return this.props.children;
        const t = this.props.t;
        return h(
          'section',
          { className: 'cd-page cd-fallback', 'aria-label': t('panel.label') },
          h('style', null, CSS),
          h(
            'div',
            { className: 'cd-fallback-box' },
            h('div', { className: 'cd-fallback-title' }, t('error.boundary.title')),
            h('p', { className: 'cd-fallback-desc' }, t('error.boundary.desc')),
            h(
              'button',
              { type: 'button', className: 'cd-newchat cd-fallback-retry', onClick: this.retry },
              t('error.boundary.retry'),
            ),
          ),
        );
      }
    }

    /** 槽位入口：给 ChatReplica 套一层错误边界，异常只坏这一块面板。 */
    function ChatPanel(props) {
      const locale = readLocaleId(props.getLocale ? props.getLocale() : null);
      const dict = locale === 'en' ? en : zh;
      const translate = function (key) {
        return dict[key] === undefined ? key : dict[key];
      };
      return h(ChatBoundary, { t: translate }, h(ChatReplica, props));
    }

    /* ---------------------------------------------------------------- plugin */

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en });
      }, 'deepseek-chat-ui: dictionaries');

      const t = ctx.locale.bind(NS);
      const getTheme = function () {
        return ctx.get('theme');
      };
      const getLocale = function () {
        return ctx.get('locale');
      };
      const getWorkspace = function () {
        return ctx.get('uiWorkspace');
      };

      ctx.slots.inject('main', function () {
        return ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
            inject: function () {
              return { getTheme: getTheme, getLocale: getLocale, getWorkspace: getWorkspace };
            },
          },
          ChatPanel,
        );
      });

      ctx.slots.inject('sidebar.panellist', function () {
        return ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 40,
            locale: NS,
            label: function () {
              return t('panel.label');
            },
          },
          PanelIcon,
        );
      });
    }

    return { inject: ['slots', 'locale'], apply: apply };
  },
});
