# 架构说明

单 Activity + Jetpack Compose 的 MVVM 应用，作为艾联猫桌面的"副屏/从控端"：接收并渲染 PC 端推送的主题包。无 DI 框架，网络层纯 OkHttp + org.json 手写。

## 技术栈

| 类别 | 选型 |
|---|---|
| UI | Compose（BOM 2026.02.01，Material 3）、navigation-compose、activity-compose、lifecycle |
| 网络 | OkHttp 4.12（WebSocket + HTTP），org.json 解析 |
| 扫码 | CameraX + zxing-core |
| 图片 | Coil（封面/封页）；渲染引擎内图片解码用自研 `ImageLoader`（同步 BitmapFactory） |
| 持久化 | DataStore Preferences、security-crypto（加密 SharedPreferences） |
| 原生 | CMake + JNI（签名校验，见下文） |
| 构建 | Gradle / AGP / Kotlin 2.2，单模块 `:app`，minSdk 24 / targetSdk 35 |

## 模块划分

```
data/           HTTP、配置存储、后端地址
domain/models/  主题包模型与 JSON 解析（跨端协议核心）
service/        HTTP 服务、天气数据服务
websocket/      连接管理、主题包推送接收
ui/             页面、渲染引擎、控件渲染器、ViewModel
utils/          图片、文件、颜色、农历等工具
cpp/            native 签名校验
```

## 应用结构与导航

- `MainActivity`（竖屏入口，release 校验签名）→ `AlinkcatApp` 组合根 → `Navigation`（6 个目的地：splash / onboarding / main / scanner / settings / profile）。
- `ThemeRenderActivity`（主题包渲染页，全屏沉浸，横竖屏跟随主题）独立于 NavHost，通过 `themeId` 启动。
- 主界面 4 个 Tab（主题 / 宏 / 配置 / 我的），Tab 切换为 `when(selectedTab)` 直换屏幕。

## 状态管理

- 各 ViewModel 为 `AndroidViewModel` 子类，状态用 `MutableStateFlow.asStateFlow()` 暴露，UI 侧 `collectAsStateWithLifecycle` 收集。
- `ConnectionViewModel` 是共享主 ViewModel：持有连接状态、PC 主题列表、推送接收、主题切换事件等。
- `ThemeRenderViewModel` 负责渲染页：加载主题、WebSocket 订阅、数据解析、动作执行。
- `PushReceiveViewModel` 桥接推送接收事件与确认弹窗（10 秒无操作自动拒绝）。

## 渲染引擎

分层自底向上：

1. **模型层** `domain/models`：`Theme → Page[] → Widget[]`（sealed 密封类）。`theme.json` 解析兼容两套 schema（新版 `page.layout` 对象与旧版扁平字段），`Widget.fromJson` 按类型分发，含字段别名兼容，未知类型返回 null 不阻塞整页。
2. **连接层** `WebSocketManager` + `DataSourceResolver`：数据源名（如 `system.battery.temperature`）→ 内部订阅键。
3. **指挥层** `ThemeRenderViewModel`：订阅、数据快照解析（battery/network 等格式归一化）、媒体状态、动作执行（`switch_page` / `open_link` / `launcher_open` / `media_*` / `action.execute`）。
4. **舞台层** `PageRenderer`：背景（底色 / Coil 图 / tile 平铺）→ 按布局模式分发：
   - `GridLayout`：网格单元格定位，横屏保持设计比例、竖屏统一单元格居中防变形；
   - `FreeLayout`：百分比坐标（freeX/freeY…）或设计像素坐标，`uniformScale` 等比缩放 + 画布居中。设计基准 1280×720。
5. **控件层** `WidgetRenderer` 路由到 17 种控件渲染器（Button / Gauge / Battery / Clock / Weather / WebView / MediaControl / Calendar …），实时数据按 dataSource 注入。

两条天气数据来源并存：`WebViewWidgetRenderer`（JSON 模式，JWT 注入 + 定位替换城市 + 定时刷新）与独立 `WeatherWidget` 类型（`GenericWeatherService` + 可配置字段映射）。

## WebSocket 与主题包推送

- 连接：`ws://{ip}:{port}`，OkHttp WebSocket，握手 10 秒超时，20 秒 ping 心跳。
- 协议：JSON-RPC 2.0（`{ jsonrpc, id, method, params }`）。
- 推送流程：`theme.push.start` → 用户确认（`ready`）→ `theme.push.chunk`（64KB base64 分块，逐块回执）→ `theme.push.complete`（SHA-256 校验）→ 解压安装。
- 接收端为 7 态状态机（IDLE / PENDING_CONFIRM / RECEIVING / COMPLETED / FAILED / CANCELLED / INTERRUPTED），含存储空间预检、zip-slip 防护、残留 `.part` 断点标记。
- 主要方法：`theme.push.*`、`theme.switch`、`media.get_current` / `media_play_pause` / `media_previous` / `media_next` / `media_volume_set`、`launcher.open`、`snippet.inject`、`action.execute`。

## 主题包结构

主题包为 zip：`theme.json`（元数据 + 页面 + 控件）与资源文件。控件定位支持网格坐标（gridRow/gridCol/rowSpan/colSpan）与自由坐标（freeX/freeY/freeW/freeH 百分比；x/y/width/height 设计像素）两套体系，按 `layoutMode`（grid / free）选择布局。

## 签名校验

见 README「关于 APK 签名校验」一节：native 层（`native_signature.cpp`）校验证书 MD5，抑制直接重打包。开源版说明与替换方法见 README。

## 给贡献者的开发提示

- 新增控件类型需要同步改四处：`WidgetType` 枚举、`Widget` 密封类与 `fromJson`、`WidgetRenderer` 路由、新增渲染器文件。
- 协议字段的兼容与别名逻辑集中在 `domain/models`，改协议先看这里。
- 布局/渲染改动参考「渲染引擎」分层：数据进 `widgetData`（`Map<String, Float>`），控件渲染器只读数据不直接连网。
