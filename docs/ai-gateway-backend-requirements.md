# AlinkCat AI — 后端需求规格（v3 new-api 集成版）

> 状态：v3 草案（集成 new-api 模型网关）
> 提交方：客户端（PC 编辑器 AI 助手 / Android 后续扩展）
> 关联既有体系：OAuth GitHub 登录（已实现）、会员等级额度（`LevelBenefits.aiChat`）、天气 Key 模式
> 关联第三方：self-hosted **new-api**（QuantumNous/new-api，模型网关）

---

## 1. 架构总览

```
┌──────────────┐   JWT              ┌───────────────────┐  令牌         ┌────────────────┐
│  PC 编辑器    │ ─────────────────▶ │ 我们后端 AI 薄代理  │ ────────────▶ │  new-api        │
│  (AI 助手)    │ ◀───────────────── │  /api/ai/*         │ ◀──────────── │  /v1/chat/...   │
│              │   SSE 流式          │  鉴权·额度·提示词注入│               │  渠道/路由/计费  │
└──────────────┘                    └───────────────────┘               └──────┬─────────┘
                                                                               ▼
                                                                    DeepSeek / 通义 / Kimi ...

┌──────────────┐  OAuth2 (SSO)      ┌───────────────────┐
│  我们后端      │ ─────────────────▶ │  new-api 登录源    │  ← 用户用 AlinkCat 账号登录 new-api
│  OAuth Server │  authorize/token/  │  (后台可看用量)    │
└──────────────┘  userinfo           └───────────────────┘
```

### 职责划分

| 层 | 职责 |
|---|---|
| **new-api** | 上游渠道管理、模型路由与故障切换、令牌额度计费、请求日志、SSE 转发 |
| **我们后端薄代理** | 用户鉴权（JWT）、每日免费额度（按天重置）、会员等级 → 模型/技能映射、云端提示词模板合并（静态 + 动态 context）、OAuth SSO 对接 |
| **客户端** | 模式切换（内置/BYOK）、动态 context 序列化、SSE 解析（现有代码不变） |

---

## 2. OAuth 绑定 new-api（SSO）

### 目标

用户用 AlinkCat 账号（密码 / GitHub OAuth）一键登录 new-api，无需在 new-api 单独注册。

### 我们后端需要实现的端点

按标准 OAuth2 Authorization Code Flow，我们后端充当 **OAuth Provider**：

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/oauth/authorize` | GET | 跳转到我们登录页，授权后回调携带 `code` |
| `/api/oauth/token` | POST | `code` 换 `access_token`（new-api 调用） |
| `/api/oauth/userinfo` | GET | 返回用户信息（new-api 用它创建/匹配本地用户） |

**new-api 侧配置**：登录设置 → OAuth 提供方 → 填入我们后端的 authorize/token/userinfo 地址 + ClientId/Secret。

> 实现参照现有 GitHub OAuth 登录（`startGithubOAuth`）的反向角色：我们不再是 GitHub 的客户端，而是自己的 OAuth 服务端。工作量：后端增加一个轻量 OAuth2 Server（3 个端点），前端基本不动。

### 绑定流程

1. 用户在 new-api 登录页选择 "AlinkCat 账号登录" → 跳转我们 `/api/oauth/authorize`
2. 用户已登录则直接授权（未登录先走我们登录页，含 GitHub OAuth）
3. 授权后 `code` → new-api 调我们 `/api/oauth/token` 换 access_token → 调 `/api/oauth/userinfo` 建账号
4. 绑定完成，new-api 为该用户签发令牌（额度 = 我们后端映射的等级额度）

---

## 3. 内置 AI 对话（我们后端薄代理）

### `POST /api/ai/chat/completions`

OpenAI Chat Completions 兼容，SSE 流式。我们后端**不真正调模型**，只做三层处理后转发 new-api：

1. **鉴权 + 每日额度**：JWT → 校验今日剩余次数 → 扣减（按天重置，new-api 令牌额度不按天）
2. **提示词合并**：云端静态模板（按 `skills` 取）+ 客户端 `context` 序列化 → 生成 system 消息前置
3. **转发 new-api**：`/v1/chat/completions`（带该用户的 new-api 令牌），SSE 原样透传回客户端

请求体：

```jsonc
{
  "model": "deepseek-chat",
  "messages": [
    { "role": "user", "content": "帮我给这个主题加一个CPU表盘控件" }
  ],
  "stream": true,
  "temperature": 0.7,
  "skills": ["theme-builder"],      // 云端静态提示词模板 id
  "context": {                       // 动态上下文（每次请求都变）
    "themeName": "我的主题",
    "pages": [ { "label": "主页", "layoutMode": "grid", "widgetCount": 3 } ],
    "activePageIndex": 0,
    "images": ["图1.png"]
  }
}
```

**流式响应**：SSE，`data: {json}` + `data: [DONE]`，`choices[0].delta.content` —— 客户端现有解析器直接用。

### `GET /api/ai/quota`

```jsonc
{
  "code": 200, "message": "ok",
  "data": {
    "level": 0, "hasMembership": false,
    "dailyQuota": 20, "usedToday": 3, "remaining": 17,
    "modelAccess": ["deepseek-chat"],
    "skills": ["theme-builder", "widget-config"]
  }
}
```

### `GET /api/ai/models`

返回当前身份可用模型（new-api 渠道里的模型，按等级过滤）。

### `GET /api/ai/skills`

返回技能目录元信息（id/名称/描述/等级/所需 context 字段）。**模板内容存服务端，不下发**。

---

## 4. 提示词云端化（核心）

### 4.1 拆分原则

| 类型 | 内容 | 存放位置 | 更新方式 |
|---|---|---|---|
| 静态模板 | 控件协议、指令 JSON 格式、输出规范、配色/布局/组件配置建议 | **我们后端配置表**（推荐）或 new-api 令牌预设 | 后台可改，热更新，零发版 |
| 动态上下文 | 主题名、页面、图片、当前页 | 客户端每次请求带 `context` | — |

> **为什么推荐放我们后端而不是 new-api 预设**：new-api 令牌预设是"固定字符串前置"，无法与每次请求的动态 context 合并（合并动作必须发生在代理层）。放我们后端配置表，一次请求内完成"模板 + context"合并再转发，最灵活。若坚持放 new-api，则动态部分必须由我们后端代理追加——最终还是要过一层代理。

### 4.2 代理层合并逻辑

```
system = skill1模板 + skill2模板 + JSON.stringify(context)
messages = [{ role: "system", content: system }, ...客户端messages]
```

### 4.3 首批技能模板（迁移自现有 promptBuilder.ts）

| skillId | 内容 | 等级 |
|---|---|---|
| `theme-builder` | 15 种控件属性协议 + 指令 JSON 格式 + 输出规范 | 0（免费） |
| `palette` | 配色顾问 | 1 |
| `layout` | 布局优化 | 1 |
| `widget-config` | webview 天气/B站、gauge 数据源等配置答疑 | 0（免费） |

---

## 5. 额度与会员映射

| 身份 | 每日次数 | 模型 | 说明 |
|---|---|---|---|
| 未登录 | 0 | — | 引导登录（密码 / GitHub / 绑定 new-api 同账号） |
| 免费 | 20 次/天 | deepseek-chat | 足够日常主题创作 |
| L1 | 100 次/天 | 基础 + 标准 | 复用 `LevelBenefits.aiChat` 字段 |
| L2 | 500 次/天 | 全部 | 同上 |

- **按天重置逻辑在我们后端**（new-api 令牌只做总额/计费用途）
- 上游失败退次数（我们后端退，new-api 侧由令牌额度兜底）

---

## 6. 错误码

| HTTP | code | 含义 | 客户端行为 |
|---|---|---|---|
| 401 | 10401 | 未登录 | 引导登录 |
| 403 | 10403 | 等级不足 | 引导开通会员 |
| 429 | 10429 | 今日额度用完 | 提示 + 引导 BYOK/升级 |
| 429 | 10430 | 频率限制 | 稍后再试 |
| 502 | 10502 | new-api/上游异常 | 提示暂不可用，退额度 |

---

## 7. 客户端改动概览

- `AIPanelSettings.tsx`：模式切换（内置/BYOK）；内置模式显示模型 + skills 选择
- `useAI.ts`：内置模式请求地址 = 我们后端 `/api/ai/chat/completions`（JWT）；BYOK 保持直连
- `aiStore.ts`：`AIConfig` 增加 `mode: 'builtin' | 'custom'`
- `promptBuilder.ts`：本地仅保留 context 序列化，静态规范迁移云端
- 会员页：AI 额度卡（剩余/总数/已用）

---

## 8. 待确认决策点

1. **OAuth 路线**：A（我们做 OAuth Provider，推荐）还是 B（管理 Key 发令牌）？
2. **提示词存放**：我们后端配置表（推荐）还是 new-api 令牌预设？
3. **new-api 部署形态**：你们自建（top.atqx.cn 同域反代？）还是独立域名？需要内网可达我们后端？
4. **上游渠道**：new-api 里首批接哪些？DeepSeek 起步？
5. **免费额度**：20 次/天是否合适？
