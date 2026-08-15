# 艾联猫 PC 端 i18n 国际化改造方案

> 版本：v1.0（规划稿）
> 日期：2026-08-15
> 范围：仅 PC 端（alinkcat-pc），Android 端另行规划

---

## 一、结论先行

**本项目可以安全地加入 i18n，不会导致大批量报错或无法启动。** 理由：

1. i18n 是**纯字符串替换工程**——把 `"主题包管理"` 换成 `t('layout.sidebar.themeManager')`，不涉及逻辑改动、类型变更、依赖重构。
2. 唯一"新增"的代码是 i18n 初始化配置 + Provider 挂载，约 30 行，位于入口层，写错也只是页面提示"未初始化"，容易排查。
3. 采用**渐进式迁移**：每个阶段结束项目都是可编译、可启动、可用的状态。

**预估工作量：** 采用 react-i18next 方案，一个开发者纯开发 + 翻译中英双语，约 **3~5 个工作日**。

---

## 二、技术选型

| 项 | 选择 | 理由 |
|---|---|---|
| 核心库 | **i18next + react-i18next** | React 生态最成熟的国际化方案，支持 React 19、命名空间、语言懒加载 |
| 语言文件 | **JSON**（按语言分目录） | 与前端工具链零耦合，翻译人员可直接编辑 |
| 加载方式 | **动态 import 按语言懒加载 + zh-CN 常驻兜底** | 新增语言包不增加启动体积 |
| 状态整合 | **新增 `useI18nStore`（zustand）** | 与现有 store 体系一致，承载"当前语言 + antd locale 对象" |
| antd 联动 | `ConfigProvider locale` 跟随语言切换 | 保证日期选择器/分页器/空状态等内置文案同步 |
| 持久化 | localStorage `ilinkcat_language` | 与项目现有 `ilinkcat_theme_mode` 模式一致 |

**不选 TypeScript 强类型 key 方案（如 typesafe-i18n）的原因：** 本项目组件文件多达 60+，改动面大，强类型方案需要为每个 key 生成类型声明，迁移门槛更高。react-i18next 的 `useTranslation()` 亦能在编译期发现问题（通过 `t()` 调用），且回归风险更低。

---

## 三、可扩展架构设计

### 3.1 新增目录结构

```
src/i18n/
├── index.ts                 # i18next 初始化 + 语言切换入口
├── languages.ts             # ★ 语言注册表（新增语言只需在此加一行）
├── useI18nStore.ts          # zustand store：currentLang + antdLocale
└── locales/
    ├── zh-CN/               # 简体中文（常驻兜底）
    │   ├── common.json      # 通用文案（按钮/提示/状态标签）
    │   ├── layout.json      # 侧边栏/顶栏/页脚
    │   ├── settings.json    # 系统设置页
    │   ├── editor.json      # 编辑器核心（组件库/属性面板/页面管理）
    │   ├── push.json        # 推送对话框
    │   ├── market.json      # 主题市场
    │   ├── profile.json     # 个人中心/登录/注册
    │   ├── devices.json     # 设备管理
    │   ├── admin.json       # 管理后台
    │   └── terms.json       # 服务条款（超长文本，可最后处理）
    └── en-US/
        └── ...              # 与 zh-CN 目录一一对应
```

### 3.2 语言注册表（可扩展核心）

```ts
// src/i18n/languages.ts
import type { Locale } from 'antd/es/locale';

export interface LanguageDef {
  code: string;                                  // 'zh-CN' | 'en-US'
  label: string;                                 // 语言切换器中显示的名称（用母语显示）
  antdLocale: () => Promise<Locale>;             // antd 内置语言包（懒加载）
  loadResources: () => Promise<Record<string, object>>; // 该语言的全部命名空间
}

export const LANGUAGES: LanguageDef[] = [
  {
    code: 'zh-CN',
    label: '简体中文',
    antdLocale: () => import('antd/locale/zh_CN'),
    loadResources: () => import('./locales/zh-CN/index.json'),
  },
  {
    code: 'en-US',
    label: 'English',
    antdLocale: () => import('antd/locale/en_US'),
    loadResources: () => import('./locales/en-US/index.json'),
  },
];
```

> **未来新增语言**（如 `ja-JP`、`ko-KR`）：在 `locales/` 下新建 `ja-JP/` 目录（复制 zh-CN 目录改翻译），在 `languages.ts` 加一行注册。**组件代码零改动。**

### 3.3 初始化流程

```ts
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LANGUAGES } from './languages';

const STORAGE_KEY = 'ilinkcat_language';
export const DEFAULT_LANG = 'zh-CN';

export function loadStoredLang(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === saved)) return saved!;
  } catch { /* ignore */ }
  return DEFAULT_LANG;
}

// 常驻兜底语言（zh-CN）同步加载，保证任何时刻都有文案可显示
const fallbackResources = await import('./locales/zh-CN/index.json');

i18n.use(initReactI18next).init({
  resources: { 'zh-CN': fallbackResources },
  lng: loadStoredLang(),
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export async function setAppLanguage(code: string) {
  const def = LANGUAGES.find((l) => l.code === code);
  if (!def) return;
  localStorage.setItem(STORAGE_KEY, code);
  // 非中文语言懒加载，加载完成后切换
  if (i18n.hasResourceBundle(code, 'common')) {
    await i18n.changeLanguage(code);
  } else {
    const resources = await def.loadResources();
    Object.keys(resources).forEach((ns) => i18n.addResourceBundle(code, ns, resources[ns]));
    await i18n.changeLanguage(code);
  }
}
```

### 3.4 antd locale 联动（useI18nStore）

```ts
// src/i18n/useI18nStore.ts
import { create } from 'zustand';
import { useTranslation } from 'react-i18next'; // 仅示例，勿在 store 中调用 hook
import { LANGUAGES, loadStoredLang, setAppLanguage } from './index';

interface I18nState {
  lang: string;
  antdLocale: any;             // 当前 antd Locale 对象
  changeLang: (code: string) => Promise<void>;
  hydrate: () => Promise<void>;
}
```

**App.tsx 中：** `<ConfigProvider locale={antdLocale} ...>` 从 store 读取，语言切换时自动重新渲染整个组件树，antd 内置文案同步切换。

### 3.5 入口挂载

```ts
// main.tsx（改造）
import './i18n';               // 先初始化 i18n（含 zh-CN 兜底）
import { useI18nStore } from './i18n/useI18nStore';
// 已有语言非 zh-CN 时，异步加载对应语言包
useI18nStore.getState().hydrate();
```

> 由于 zh-CN 常驻兜底，即使语言包尚未加载完，页面也能以中文正常渲染，不会白屏。

---

## 四、逐文件改动清单

> 优先级：🔴=必改（M0-M2 阶段）｜🟡=应改（M3 阶段）｜🟢=可后补（M4+ 阶段）

### M0 基础设施（新增，几乎零风险）

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/i18n/index.ts` | ✅ 新增 | i18next 初始化、语言切换 |
| `src/i18n/languages.ts` | ✅ 新增 | 语言注册表 |
| `src/i18n/useI18nStore.ts` | ✅ 新增 | zustand store |
| `src/i18n/locales/zh-CN/*.json` | ✅ 新增 | 中文文案（从现有代码提取） |
| `src/i18n/locales/en-US/*.json` | ✅ 新增 | 英文翻译 |
| `package.json` | ✏️ 修改 | 添加 `i18next`、`react-i18next` 依赖 |

### M1 入口 + 全局框架（改动小，风险低）

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/main.tsx` | ✏️ 修改 | 引入 `./i18n`，调用 `hydrate()` |
| `src/App.tsx` | ✏️ 修改 | `ConfigProvider locale` 改为从 store 读取；版本门 elain 弹窗文案（下载更新/退出应用/我知道了/系统维护/版本更新）抽 key |
| `src/components/layout/AppSidebar.tsx` | ✏️ 修改 | 菜单项 7 条 + 登录/注册 + 退出登录 |
| `src/components/layout/AppHeader.tsx` | ✏️ 修改 | Logo 标题、主题切换 tooltip、通知/设置 tooltip |
| `src/components/layout/AppFooter.tsx` | ✏️ 修改 | 服务运行中/已停止、端口、设备数 |

### M2 设置页 + 语言切换器（本需求核心）

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/pages/Settings.tsx` | ✏️ 修改 | ① 新增「语言」Form.Item（Select，数据源 `LANGUAGES`）；② 保存时写 `ilinkcat_language` 并调用 `setAppLanguage()`；③ 页面内其余文案全部抽 key |
| `src/types/theme.ts` | ✏️ 修改 | `AppSettings` 增加可选字段 `language?: string`（兼容旧数据） |

> **语言切换即时生效**：选择语言 → `setAppLanguage()` → antd locale 更新 → 全局重渲染。无需重启应用。

### M3 编辑器核心（工作量最大，但为纯替换）

| 文件 | 中文字符量 | 说明 |
|---|---|---|
| `src/pages/Editor/components/PropertyPanel.tsx` | 828 | 🔴 最大改造面：各组件属性表单标签、校验提示、ColorInput 等。按 widget 类型分组抽 key（`editor.prop.*`） |
| `src/pages/Editor/index.tsx` | 188 | 🔴 工具栏、状态栏（组件数/页面数）、保存/导出按钮 |
| `src/pages/Editor/components/ControlLibrary.tsx` | 46 | 🟡 15 种组件名称与工具栏提示 |
| `src/pages/Editor/components/PageManager.tsx` | — | 🟡 页面增删、重命名确认弹窗 |
| `src/pages/Editor/components/AIPanel/*` | 293 | 🟡 AI 面板：输入占位、会话列表、删除确认、设置项 |
| `src/pages/Editor/hooks/useWidgetDrag.ts` | — | 🟢 若含提示文案则替换 |
| `src/pages/Editor/store/editorStore.ts` | 70 | 🟢 仅 store 内用户可见的默认 label 等 |

### M4 主要页面（量大但机械）

| 文件 | 中文字符量 | 优先级 |
|---|---|---|
| `src/pages/Devices.tsx` | 305 | 🔴 |
| `src/pages/Auth.tsx` | 276 | 🔴 |
| `src/pages/Themes.tsx` | 232 | 🔴 |
| `src/pages/Profile.tsx` | 347 | 🟡 |
| `src/components/OAuthLogin.tsx` | 349 | 🟡 |
| `src/pages/Market.tsx` + `MarketDetail.tsx` | 189 | 🟡 |
| `src/pages/Snippets.tsx` | 154 | 🟡 |
| `src/pages/MyCloud.tsx` | 180 | 🟡 |
| `src/pages/Member.tsx` | 154 | 🟢 |
| `src/pages/Points.tsx` | 266 | 🟢 |
| `src/pages/Invite.tsx` | 181 | 🟢 |
| `src/pages/Notifications.tsx` | 81 | 🟢 |
| `src/pages/UploadCenter.tsx` | 281 | 🟢 |
| `src/pages/Tickets.tsx` | 183 | 🟢 |
| `src/pages/OAuthCallback.tsx` | 79 | 🟢 |
| `src/components/ThemeTable.tsx` / `ThemeCover.tsx` / `FavoriteButton.tsx` / `DownloadProgress.tsx` / `BenefitsComparison.tsx` | 各 40-75 | 🟢 |
| `src/components/VersionPolling.tsx` | 145 | 🟡 |
| `src/components/AuthExpiredModal.tsx` / `ErrorBoundary.tsx` | — | 🔴 全局弹窗 |

### M5 管理后台（可按需延后）

| 文件 | 中文字符量 | 说明 |
|---|---|---|
| `src/pages/AdminDashboard.tsx` / `AdminThemeReview.tsx` / `AdminTickets.tsx` | 45 / 62 / 60 | 🟢 管理员专用，可先保持中文 |

### 特殊/暂缓处理项

| 文件 | 中文字符量 | 建议 |
|---|---|---|
| `src/pages/Terms.tsx` | 1630 | 🟢 **暂缓**：服务条款是超长法律文本，建议中英版本走"页面内切换"而非逐行抽 key。第一版可保留中文 |
| `src/utils/promptBuilder.ts` | 783 | 🟢 **暂缓**：发给 AI 的系统提示词。若翻译，需同步保证 `useAICommands` 的指令解析关键词一致（见下） |
| `src/hooks/useAICommands.ts` | 170 | 🔴 **注意**：其中"添加组件/删除组件"等解析关键词是**逻辑常量**，不要翻译；仅翻译 AI 面板向用户展示的提示 |
| `src/utils/lunarUtils.ts` / 日历组件 | 68 | 🟢 **暂缓**：农历/节气为数据型内容，英文翻译需专门研究，可后续单独处理 |
| `src/utils/logger.ts` | — | 不改：console 日志 |
| `src/api/*.ts` 中报错文案 | 62 | 🟡 钓鱼：服务端返回的中文错误信息**不翻译**（后端文案）。前端补充的兜底文案才需要替换 |
| `src/hooks/useThemePush.ts` / `src/types/push.ts` | 71 / 82 | 🟡 状态标签、错误提示 |
| `src/store/aiStore.ts` | 153 | 🟡 UI 文案（"正在思考…"等）需要翻译 |

---

## 五、实施阶段规划

| 阶段 | 内容 | 产出 | 可运行性 |
|---|---|---|---|
| **Phase 0** | 安装依赖、创建 i18n 目录与 zh-CN 语言包（先抽 30% 核心文案）、挂载入口 | 项目跑通，中文无感 | ✅ 可运行 |
| **Phase 1** | App/ 布局组件 / 全局弹窗全部抽 key；Settings 页加语言切换器 | **语言切换功能可用**，antd 文案同步 | ✅ 可运行 |
| **Phase 2** | Editor 全部组件抽 key + en-US 翻译 | 编辑器双语 | ✅ 可运行 |
| **Phase 3** | 主要页面（Devices/Auth/Themes/Profile/OAuth/Market 等）双语 | 全站基本双语 | ✅ 可运行 |
| **Phase 4** | 次要页面 + 管理后台 + 状态标签补齐 | 完整双语 | ✅ 可运行 |
| **Phase 5** | 扫描遗漏字符串、Terms 页语言方案、AI 提示词/农历本地化评估 | 收尾验收 | ✅ 可运行 |

> 每个 Phase 独立交付、可运行、可回退。任何时刻中止，应用都能正常工作（只是部分文案未翻译）。

---

## 六、风险与注意事项

| 风险 | 等级 | 应对 |
|---|---|---|
| i18n 初始化配置写错 → 页面提示未初始化 | 低 | Phase 0 单独验证；配置仅约 30 行 |
| 漏翻译 → 中英混杂 | 中 | Phase 5 用脚本扫描残留中文字符（`grep -rlP '[\x{4e00}-\x{9fff}]' src --include="*.tsx" --include="*.ts"`） |
| 解析关键词被误翻译 → AI 指令失效 | 低 | `useAICommands` 的匹配关键词保留中文常量，仅翻译展示文案 |
| antd locale 未联动 → 分页器/日期选择器仍中文 | 低 | ConfigProvider locale 由 store 驱动，Phase 1 专门验证 |
| Terms 超长文本拖慢进度 | 低 | 明确暂缓，方案另行设计 |
| 组件内 `message.success('xxx')` 改成 `t()` 后闭包失效 | 低 | 少数场景注意依赖 i18n 实例而非组件内 `t`（用 `i18n.t()`） |
| Settings 保存旧数据无 `language` 字段 | 低 | `AppSettings` 加可选字段，读取时给默认值 |
| 时钟组件"上午/下午"、日期格式 | 低 | 使用 i18next 的 locale 化时间格式；暂缓项 |

---

## 七、验收标准

1. **切换路径**：`系统设置 → 语言 → English`，界面立即变为英文，无需重启。
2. **antd 联动**：输入框校验提示、分页器、Modal 确定/取消按钮随之切换。
3. **持久化**：重启应用后保持上次选择。
4. **兜底**：语言包缺漏 key 时显示中文（fallback 生效），不白屏、不报错。
5. **功能无回归**：编辑器拖拽、AI 指令执行、主题推送、WebSocket 连接在两种语言下均正常。
6. **可扩展**：新增语言包只需复制目录 + 注册表中加一行，无组件代码改动。

---

## 八、新增语言操作手册（供后续使用）

1. 在 `src/i18n/locales/` 下复制 `zh-CN/` 为 `ja-JP/`，逐个 JSON 文件翻译。
2. 在 `src/i18n/languages.ts` 的 `LANGUAGES` 数组加一项：
   ```ts
   {
     code: 'ja-JP',
     label: '日本語',
     antdLocale: () => import('antd/locale/ja_JP'),
     loadResources: () => import('./locales/ja-JP/index.json'),
   }
   ```
3. 完成。语言切换器会自动出现新选项。

---

## 九、依赖清单

```bash
npm i i18next react-i18next
```

（antd v6 的 locale 包已随 antd 自带，无需额外安装。）