# alinkcat-android 代码级深度分析报告

> 生成：2026-09-05 ｜ 分析方式：核心文件全文精读（5 文件约 2350 行）+ PC↔Android 跨端协议对读 + ARCHITECTURE.md 交叉验证
> 范围：渲染引擎、连接与推送层、数据模型、服务与 UI 层
> 所有论断附证据（相对 `alinkcat-android/app/src/main/java/com/ailinkcat/mobile/` 的 文件:行号；PC 端以 `alinkcat-pc/src-tauri/` 标注）

---

## 一、架构结论（确认）

- 单 Activity（MainActivity + ThemeRenderActivity）+ Compose MVVM；**无 DI**（手写 viewModelFactory）、**无 Retrofit/Gson**（纯 OkHttp 4.12 + org.json）
- `ConnectionViewModel`（378 行）是活动级"上帝对象"：持有 DataStoreManager + PushReceiveManager + WebSocketManager，init{} 完成全部接线
- 两套 WebSocket：主界面连接（仅启动失败重试 3×2s，无断线重连）+ 渲染页独立连接（5s 定时重连、设备名加 `" (Display)"` 后缀防互踢）
- 渲染引擎分层清晰：模型层（Widget.kt 704 行）→ 数据总线（WebSocketManager/DataSourceResolver）→ 指挥层（ThemeRenderViewModel 458 行）→ 舞台层（PageRenderer/GridLayout/FreeLayout）→ 道具层（WidgetRenderer + 17 渲染器）
- 认证体系已删除（无 TokenManager/LoginViewModel），AuthApi 仅剩 BASE_URL 占位；天气云端接口统一 X-API-Key

---

## 二、🔴 跨端协议级 Bug（PC↔Android 对读确认，最高优先级）

### Bug 1：断点续传协议断裂——功能实际不可用
- PC 端 `theme_push_commands.rs:345-351`：`start_chunk > 0` 时**跳过 start 握手**直接从该块发 chunk
- Android 端 `PushReceiveManager.kt:200`：`onThemePushChunk` 仅当 `status == RECEIVING` 才处理；进入 RECEIVING 的唯一路径是收到 `theme.push.start` → 用户确认（`acceptPending`）
- **断点续传路径（start_chunk>0）：无 start 握手 → Android 状态停在 INTERRUPTED → chunk 全部被静默丢弃 → PC 8s 超时×3 → 推送失败**
- **全量重发路径（start_chunk=0 + .part 残留）：`acceptPending` 用追加写 `FileOutputStream(tempFile, isResume)`（L157）→ 重复内容 → SHA-256 必然失败**
- 结论：两条续传路径都坏；`isResume` 检测（L110）、INTERRUPTED 状态、.part 保留机制形同虚设

### Bug 2：PC 端忽略手机端失败响应——假成功
- PC 端 `theme_push_commands.rs:380`：`send_and_await(...).await;` **丢弃返回值**
- Android 端 hash 校验失败会回 `-32021` 错误（`PushReceiveManager.failCurrent` L388）→ PC 端仍 emit `theme-push-complete` 成功
- 后果：**UI 显示推送成功，手机端实际失败**，用户无从得知

### Bug 3（中）：WebSocketManager 双重失败回调
- `onOpen` 置 `handshakePending=true` 并 postDelayed 10s 超时（L126-127）；**`onFailure` 不清 pending、不 removeCallbacks**（L171-177）
- 场景：onOpen 后握手完成前连接失败 → onFailure 回调一次 → 10s 后超时任务**再次**回调 `onConnectionFailed(HANDSHAKE_TIMEOUT)`
- 后果：ConnectionViewModel 的 `onAutoConnectFailed()` 重试计数**加倍**（3 次实际约 2 次）；修复：onFailure/onClosed 中 `handshakePending.set(false)` + `removeCallbacks`

### Bug 4（中）：PC 端进度计算基于 base64 字符数
- `theme_push_commands.rs:357`：`sent = start + chunk.len()`（base64 字符），而 `size` 是二进制字节（L360）——base64 虚高 ~33%，`min(100.0)` 掩盖；sentSize/speed 显示不准

---

## 三、核心文件精读发现

### 3.1 ConnectionViewModel.kt（378 行）

| 严重度 | 问题 | 证据 |
|---|---|---|
| 🟠 | **isAutoConnecting 状态残留**：`onHandshakeSucceeded` 成功路径未复位 `isAutoConnecting=false`；启动自动连接成功后再失败，`onAutoConnectFailed` 继续走重试计数 | L78-86, L113-138 |
| 🟠 | **远程切主题逻辑无效**：`theme.switch` 本地无此主题时仅 `refreshThemePackages()`（刷本地列表）——列表里仍没有该主题，未触发推送请求或提示 | L144-152 |
| 🟠 | **mock 示例主题污染**：PC 列表为空时塞入 4 个不存在的假主题（Aurora Blue/Sakura Pink…），用户点击打开不存在主题 | L369-377 |
| 🟡 | 握手 `themeList` 是 `List<String>` 名称列表，构造 `ThemePackage` 无 themeId（空串），后续 id 相关操作隐患 | L353-367 |
| 🟡 | `handleMacroMessage` 空 catch 吞异常；`appVersion="1.0.0"` 硬编码 | L36, L282 |
| 🟡 | `connect()` 手动路径 `isAutoConnecting=false` 但 `autoRetryCount` 不归零（语义混杂） | L186 |

### 3.2 PushReceiveManager.kt（527 行）

| 严重度 | 问题 | 证据 |
|---|---|---|
| 🔴 | 断点续传跨端断裂（见 Bug 1） | L110, L157, L200 |
| 🟠 | **PENDING_CONFIRM 中断状态残留**：`handleConnectionLost` 确认阶段只打日志，不清 `pendingStartId/pendingStartParams`——旧连接的 requestId 会流向新连接无人消费；10s 超时后 reject 也发往已断连接 | L321-324 |
| 🟠 | **finalizeReceive 与同步块竞争**：SHA-256/解压在 IO 协程（无 @Synchronized），期间 `handleConnectionLost`/`cancelReceive` 可并发删 .part → sha256 null → 失败（结果一致但状态竞争） | L256-266, L468-521 |
| 🟡 | `scope = CoroutineScope(SupervisorJob()+IO)` 无父 Job，未随 onCleared 取消 | L45 |
| 🟡 | 续传未校验 `.part` 已收大小 vs 本次 totalSize（同 themeId 不同内容 → 进度>1 或 fail） | L110-129 |

### 3.3 ThemeRenderViewModel.kt（458 行）

| 严重度 | 问题 | 证据 |
|---|---|---|
| 🟠 | **无限重连**：`scheduleReconnect` 无上限（每 5s 一次），渲染页存活期间 PC 不在线则无限重试；onConnectionClosed 与 onConnectionFailed 都会触发 | L181-191 |
| 🟠 | **open_link 未捕获 ActivityNotFoundException、URL 不校验 scheme**（外部主题可控 `file://` 等） | L323-330 |
| 🟡 | `widgetData` 每次推送整体 `Map +` 复制（1s 一次）→ 全部数据型控件重组 | L292 |
| 🟡 | `leaveTheme` 在 WS 未连接时发送被静默丢弃 → PC 端订阅残留（无补偿，enter 有补偿） | L174-179 |
| 🟡 | `launcher_open` 分支缩进错乱（可读性） | L339-346 |

### 3.4 WebSocketManager.kt（286 行）

| 严重度 | 问题 | 证据 |
|---|---|---|
| 🟠 | 双重失败回调（见 Bug 3） | L171-177 |
| 🟡 | 重复 `connect()` 不关旧连接（引用覆盖，OkHttp 内部持有至超时） | L119-123 |
| 🟡 | `onClosing`+`onClosed` 都可能回调 `onConnectionClosed`（双回调，靠下游幂等） | L162-169 |
| 🟡 | Listener 回调在 OkHttp 线程；ThemeRenderViewModel 直接 `_uiState.update`（线程安全但违反 Compose 快照主线程惯例） | L133-160 |

### 3.5 Widget.kt（704 行，数据模型）

| 严重度 | 问题 | 证据 |
|---|---|---|
| 🟠 | **properties 嵌套读取不一致**：MediaControl/SystemMonitor/Date 的布尔/字段只读 `properties`，PC 端导出常在顶层——且 `showCpu` vs PC 端可能导出的 `showCPU` 大小写不匹配 → 默认值兜底掩盖 | L409-416, L453-461, L546-552 |
| 🟡 | **单控件解析失败静默丢失**：所有 fromJson `getString("id")` 抛异常 → catch 返回 null → 整个控件消失（非降级占位）；未知类型 else→null 同样静默 | L81-101, 各 fromJson |
| 🟡 | freeW/freeH=0 会保留（非法尺寸），渲染层无校验 | L70-73 |
| 🟡 | 17 个控件 × 复制粘贴式 fromJson，加新控件需改 4 处（枚举/分发/路由/渲染器） | 全文 |

---

## 四、已知问题汇总（来自 ARCHITECTURE.md 交叉验证 + 实测）

- 🔴 `ShapeWidgetRenderer.kt` **UTF-8 编码损坏**（中文字节与 0x3F 混排）——改前必须先转码
- 🟠 `ImageLoader` 自研同步 BitmapFactory 无采样/无缓存 → 大图 ANR/内存峰值
- 🟠 `JsonDataCache`（WebViewWidgetRenderer）全局 HashMap **无界不清**、键仅 URL（同 URL 跨主题串缓存）
- 🟠 WebView 模式 `AndroidView` 未在 onDispose `webView.destroy()` → 泄漏
- 🟡 `ConnectionViewModel` 上帝对象（378 行多职责）；`AuthApi.BASE_URL` 硬编码内网 IP
- 🟡 `appVersion="1.0.0"` 硬编码 3 处；天气 Key 明文存 SharedPreferences
- 🟡 主题列表双源（PC 列表 vs 本地扫描）在 ThemeListScreen 内直接做 File IO
- 🟡 `LunarCalendar` 中文硬编码不可本地化；`GenericHttpService` 与 `AuthApi` 两块独立 OkHttpClient
- 🟢 无断线重连（主界面）、无退避、`GET_SIGNATURES` 废弃 API

---

## 五、改进路线（按优先级）

**P0 · 协议与正确性**
1. 重做断点续传：Android 端支持"恢复模式"（start 握手携带已收大小/start_chunk 回执），或统一改为全量覆盖写 + PC 端不跳过 start
2. PC 端 `run_push` 检查 complete 响应：手机端失败时 emit 失败事件
3. WebSocketManager onFailure/onClosed 清理握手定时器（Bug 3）
4. 修复 ConnectionViewModel：成功路径复位 isAutoConnecting；远程切主题缺主题时请求推送/明确提示；去掉 mock 主题

**P1 · 稳定性**
5. `open_link` 校验 scheme + 捕获 ActivityNotFoundException；ThemeRenderViewModel 重连加次数上限
6. finalizeReceive 纳入同步或改为无锁状态机；PENDING_CONFIRM 中断清理 pending 状态
7. WebView destroy、JsonDataCache 加 TTL/上限、ImageLoader 换 Coil（已有依赖）

**P2 · 架构**
8. 拆 ConnectionViewModel；Widget 解析改注册表 + 未知类型告警；properties/顶层字段统一
9. 统一 AuthRepository + OkHttp 拦截器；BuildConfig 注入服务器地址
10. ShapeWidgetRenderer 编码修复；LunarCalendar 本地化；版本号用 BuildConfig.VERSION_NAME

---

## 六、连接推送层深度评审（子代理完整报告精华）

> 评审：WebSocketManager/ConnectionViewModel/PushReceiveManager/PushModels/JsonRpc/PushReceiveViewModel/对话框/MainActivity/DataStoreManager/ThemeRepository/FileUtils

### 6.1 新增高危发现（本报告第三章未覆盖）

| # | 问题 | 证据 |
|---|---|---|
| A1 🔴 | **JSON-RPC 响应被误当握手响应**：任何 `method==null` 消息（标准 response，如 launcher.list 的 `{id,result}`）落入 `handleHandshakeResponse`。握手窗口期内任意响应 CAS 消费 `handshakePending` → 以空 deviceId/空 themeList 触发假"已连接"（回退 mock）；握手完成后到达的响应被**静默吞掉** → `requestLauncherList()/requestSnippetList()` 的响应永远到不了 `handleMacroMessage`，宏/片段列表**静默失效**（依赖 PC 通知式推送才工作） | WebSocketManager.kt:136-139, 181-206 |
| A2/B2 🔴 | **connect() 不关旧 socket + 共享 handshakePending**：init 的 autoConnect 与手动 connect 可重叠，两条连接共享同一 AtomicBoolean → 旧连接握手响应/超时可消费新连接的 pending → 新连接永不触发 onHandshakeSucceeded，UI 卡 Connecting | :103-131, 181-206; ConnectionViewModel.kt:113-138, 161-193 |
| C1 🔴 | **PENDING_CONFIRM 期间第二个 start 无条件覆盖**（busy 只挡 RECEIVING）→ 第一个主题永远收不到回执，PC 挂起等 ack | PushReceiveManager.kt:84-90, 115-130 |
| C2 🔴 | **chunk 三处静默丢弃**：解码失败/空数据/状态不匹配直接 return，不回 ack 不回错误 → PC 等 chunk ack 永久挂起；写失败只回 -32030 错误但不中止，后续继续写 | :198-217 |
| C3 🔴 | **chunkIndex 被完全忽略**：无条件 append，PC 因 ack 丢失重发同块 → 重复数据 append → `received>totalSize` → 整次失败；`isLast` 字段从未使用 | :210-224; PushModels.kt:35-53 |

### 6.2 中危补充

- **C4**：`hasInterruptedTransfer()` 是**死代码**（grep 无调用方），"发现未完成传输是否继续"UX 未接线；PENDING_CONFIRM 中断后状态不清理
- **C5**：无接收看门狗——PC 停发 chunk 则永久卡 RECEIVING；进度框禁返回键/外点关闭，用户只能"取消"（删 .part 丢续传数据）
- **C6**：`finalizeReceive` 在独立 IO 协程读共享 `expectedHash`，与读线程写入无互斥（设计缺陷窗口）
- **C10**：更新已存在主题时未清空旧目录（unzipTo 覆盖写，旧文件混入）；unzip 失败 `deleteTheme` 删**整个旧安装** → 更新失败即旧主题丢失
- **C11/F1**：空间检查 ×1.5 针对压缩包大小，高压缩比 zip 解压可远超（zip bomb）；resume 时已下载字节被重复计入 → 续传过度保守拒绝
- **D1**：`PushReceiveViewModel` 无 `onCleared` 置空 `manager.listener` → Activity 销毁后旧 VM 被强引用泄漏
- **B1**：`themeSwitchEvent`（extraBufferCapacity=1, DROP_OLDEST, 无 replay）——启动早期、订阅前的 theme.switch 永久丢失；连续切换只留后者
- **B3**：`onAutoConnectFailed` 在 OkHttp 读线程改非 volatile 的 `autoRetryCount/isAutoConnecting`，与主线程并发 → 计数错乱；3 次失败后无恢复路径（无退避/无网络监听）
- **E2**：`SignatureVerifier` 遗留调试日志 `Log.d("SigVerify", "computeCertMD5=...")` 打印证书 MD5（release 泄露证书指纹）
- **E1**：`GET_SIGNATURES` 废弃 API，多证书只验第一个
- **G1**：双 WebSocket 连接各自独立 OkHttpClient（两个线程池）；主连接的 `monitor.*` 数据进 `handleMacroMessage` 后被丢弃（仅渲染连接消费）
- **A5**：`readTimeout=0` 无接收看门狗，半开连接只能靠 20s ping 感知

### 6.3 连接推送层修复优先级（8 件事）

1. 响应路由修复（A1）：`method==null` 响应不进握手；按 `id==1` 精确匹配握手，其余按 id 分发
2. connect 单飞化 + 握手状态实例化（A2/B2）：连接前 cancel 旧 socket；handshakePending 改连接私有；计数器改原子类型 + 退避
3. 状态机补洞（C1/C2）：PENDING_CONFIRM/INTERRUPTED 期间新 start 回 busy/reject；chunk 失败必须回错误
4. 断点续传一致性（C3）：`chunkIndex==receivedChunks` 校验；complete 校验字节/块数；启用 `isLast`
5. 接收看门狗 + INTERRUPTED UX（C4/C5）：无进展超时 → INTERRUPTED 保 .part；接线"继续传输"流程
6. finalize 快照化（C6/F2）：共享字段封装不可变 ActiveTransfer；manager 提供 close()
7. themeSwitchEvent 不丢事件（B1）+ 宏数据装载（B5/A1 联动）：replay=1 或待切换 StateFlow；握手后主动拉取
8. 安全加固（F1/E1/E2/C10）：unzipTo 加解压大小上限；更新前清空目录；getSigningInfo；删调试日志

---

## 七、渲染引擎核心深度评审（子代理完整报告精华）

> 评审：WebSocketManager（渲染页视角）/ ThemeRenderViewModel / ThemeRenderScreen / PageRenderer / GridLayout / FreeLayout / WidgetRenderer / ThemeRenderActivity / DataSourceResolver

### 7.1 高危发现（补充第三章）

| # | 问题 | 证据 |
|---|---|---|
| W1 🔴 | **JSON-RPC 响应被吞的连锁后果**（A1 在渲染页的延伸）：`media.get_current` 的 result 响应永远到不了 VM → `parseMediaState` 的 `?: root.optJSONObject("result")` 兼容分支是**死代码**，进入页面媒体初始状态为空；RPC error 响应（launcher.open 失败、订阅被拒）同样被吞 → `actionError` 分支与 Toast 提示**形同虚设**；error 若恰好落在握手窗口内 → 被当握手失败 → **无端重连** | WebSocketManager.kt:136-139; ThemeRenderViewModel.kt:197-202, 214-218; ThemeRenderScreen.kt:75-80 |
| W2 🔴 | **握手超时只回调、不关闭 socket**：超时后底层 socket 继续存活，VM 5s 后新建第二连接 → **双连接双订阅、monitor.data 双份推送**；共享 `handshakePending` 被双连接互相干扰 | WebSocketManager.kt:105-113, 119-131 |
| V5 🔴 | open_link 无 scheme 校验 + 无 startActivity 异常捕获（第三章已列）——主题包可控内容：`file:`/`javascript:` 崩溃，任意 scheme 可拉起任意应用（intent 注入面） | ThemeRenderViewModel.kt:323-330 |

### 7.2 中危补充

- **V1**：`entered` 补偿存在双发窗口 + 线程可见性问题（entered 非 volatile，onHandshakeSucceeded 在 OkHttp 线程读）——enterTheme 与补发之间可能双发或漏发
- **V3**：5s 固定重连无指数退避、无生命周期感知——PC 离线时约每 20s 一次长连接尝试，**后台持续耗电 + 服务端日志噪音**
- **V2**：`requestId` 非原子自增，跨线程（OkHttp 线程 + 主线程）并发 → id 重复/错序
- **S1**：`enterTheme` 在主题加载失败/进行中**也触发**（LaunchedEffect 不依赖主题状态）→ 损坏主题的错误页照常连 WS 发 theme.enter → 服务端激活主题、网络空转
- **S2**：`theme.pages` 为空 → HorizontalPager pageCount=0 → **黑屏无任何提示**
- **P1**：tile 背景模式全尺寸解码无降采样（ImageLoader 无 inSampleSize）→ 4K 图 ≈ 50MB 内存、超 GPU 最大纹理上限
- **V6**：`widgetData` **只增不删、无 TTL**（`it.widgetData + map`）——服务器推送带时间戳/随机键时 map 无限增长，停更源长期显示陈旧值
- **G4**：GridLayout 在数据推送时全量重组（与第三章 widgetData 整体复制联动）
- **V7**：`network` 字段非对象时整组数据丢失（`?: continue`）；battery 对象无 level 键不写入

### 7.3 渲染引擎修复优先级

1. W1：响应按 JSON-RPC id 分发（id==1 且无 method 才进握手）——同时救活 media.get_current、actionError、launcher 响应
2. V5：open_link scheme 白名单（http/https）+ try-catch
3. W2/V3：握手超时/失败时 `webSocket.cancel()`；重连指数退避（5s→60s 封顶）+ 抖动 + onStop 暂停；connect 加 generation 防孤儿回调
4. V1/V2：entered/requestId 收敛到单线程调度（Mutex/AtomicInteger）；sendThemeEnter 幂等
5. S1/S2：enterTheme 移到主题加载成功分支；pages 空时显示错误态
6. V6/P1：widgetData 按订阅源白名单（INTERNAL_KEYS 已定义未用）+ 批次替换；tile 解码降采样

---

## 八、控件层深度评审（17 个渲染器，子代理完整报告）

> 评审：widgets/ 下全部 17 个渲染器 + WebViewWidgetRenderer(694 行)重点 + 支撑类

### 8.1 高危发现

| # | 问题 | 证据 |
|---|---|---|
| Wv1 🔴 | **WebViewWidgetRenderer 的 `AndroidView` 未在 onDispose `webView.destroy()`**——确定的内存泄漏（每个 WebView 控件离开页面后 WebView 进程/内存不释放） | WebViewWidgetRenderer.kt:91-104 |
| Wv2 🔴 | **JsonDataCache 无界 + 键仅 URL**：跨主题同 URL 串数据（A 主题缓存被 B 主题读取）；HashMap 只增不减内存增长 | :110-119, 296 |
| Mc1 🔴 | **MediaControlWidgetRenderer 插值键错配**：`remember` 键含 `position` 而 `LaunchedEffect` 键不含（:58-61）→ 60fps 本地插值在数据变化时**冻结/回跳**；`baseSystemTime` 默认 0（Widget.kt:437）→ **进度条满格** | MediaControlWidgetRenderer.kt:58-61 |
| Sh1 🟠 | **Shape 描边后内部空心**：`strokeWidth>0` 时 fill 用 Stroke 样式（:40-43）→ 填充色不显示；圆角固定 12dp | ShapeWidgetRenderer.kt:40-43 |

### 8.2 中危补充

- **Gauge/Battery**：NaN 未消毒（`coerceIn` 不滤 NaN）；文本显示原始值 vs 图形用 clamp 值不一致（Gauge:51-53/118、Battery:63/200/267）
- **Clock**：nativeCanvas 混用绕 Compose 变换（:188-207）；数字钟 60s 滞后（不跨分钟刷新）
- **Weather 双管线**：`WeatherWidgetRenderer` vs `WebViewWidgetRenderer` 天气逻辑重复；hourly[6] vs hourly[0] 图标不一致；天气 Key 非响应式读取
- **跨渲染器**：widgetData 只增不减（ThemeRenderViewModel:292）；日期/时钟类无午夜 ticker（跨天不刷新）；`data:` URI 各渲染器支持不一致
- **WebView 其他**：定位替换只认字面 `city=`/`q=`；两套 host 重写叠加（BASE_URL vs top.atqx.cn）

### 8.3 控件层修复优先级（Top 10 节选）

1. WebView onDispose destroy（泄漏）→ 2. MediaControl 键错配 + baseSystemTime 兜底 → 3. JsonDataCache 加 TTL/上限/主题隔离 → 4. Shape 描边填充样式 → 5. Gauge/Battery NaN 消毒 → 6. 时钟午夜 ticker → 7. 天气管线合并 → 8. widgetData 白名单 → 9. data:URI 统一 → 10. WebView 刷新计时器生命周期

---

## 九、模型/服务/UI 层深度评审（子代理完整报告）

> 评审：Widget.kt(704)/Theme.kt/WeatherWidget.kt/Models.kt/JsonPath/LunarCalendar/ThemeRepository/GenericHttpService/GenericWeatherService/LocationUtil/AuthApi/DeviceInfoProvider/FileUtils/ImageLoader/ColorParser/Navigation/MainScreen/ThemeListScreen/ConfigScreen/ScannerScreen/SettingsScreen/MacroScreen/ProfileScreen/Onboarding/Splash/CityOptions

### 9.1 高危发现

| # | 问题 | 证据 |
|---|---|---|
| M-W1 🔴 | **天气控件 map 值 `getString` 强读**：headers/extraParams/responseMapping 任一值为数字/布尔即抛异常 → **整个天气控件被 catch 吞成 null 静默消失** | WeatherWidget.kt:104,114,124,160-162 |
| T3 🔴 | **主题列表双源功能性冲突**：握手返回的 themeList 是名称列表（themeId 永远 null）→ Connected 状态下**已本地安装的主题也无法打开**（onThemeClick 判空弹"未下载"）、长按删除失效 | ThemeListScreen.kt:140-154 + ConnectionViewModel.kt:353-363 |
| Sec1 🔴 | **凭据明文 + 备份外泄**：weather_api_key 明文 SharedPreferences（`ilinkcat_prefs`）+ `allowBackup=true` 且 backup/data_extraction 规则为空 → **Key 与配对码随云备份/设备迁移导出**；工程已依赖 security-crypto 却未使用 | SettingsScreen.kt:227 + Manifest:17 + backup_rules.xml:8-12 |

### 9.2 中危补充

- **ScannerScreen CameraX 竞态**：`ProcessCameraProvider.getInstance` future 回调与 onDispose 无顺序保证——dispose 后 future 才完成会在 unbindAll 之后重新绑定且无人解绑（相机占用）；dispose 内 `cameraFuture.get()` 未就绪会**阻塞主线程**（:141-167）
- **主线程文件 IO**：ThemeListScreen 页数统计对每主题 `File.exists + readText + JSONObject`（:89-95, 112-113）
- **扫码 JSON 无校验**：`optString("ip")` 任意非空接受、port 不校验数字 → `ws://$ip:$port` 注入（ConfigScreen.kt:344-353 + ConnectionViewModel.kt:191）；纯 4 位数字文本扫码"成功"但表单不填充
- **LocationUtil 缓存位置无时效过滤**（:49-54）：可能按数小时前的旧位置查天气
- **LunarCalendar 2100 边界输出垃圾**：表外日期可算成"腊月45"（:85-127）
- **zip bomb 无解压上限**：unzipTo 不限制 entry 数与解压总量（FileUtils.kt:71-93），1.5× 空间预检只针对压缩包
- **ImageLoader 全尺寸解码**：4000×3000 背景 ≈ 46MB 无采样（:21-28）；相册解码 12MP + getPixels 双份内存（ScannerScreen:267,272）
- **配置回填竞态**：`LaunchedEffect(config)` 每次 config 变化重置表单，连接成功后用户编辑被回填覆盖（ConfigScreen:82-86）
- **ThemeRepository 旧主题不可见**：只认有 meta.json 的目录，旧版本推送主题（无 meta）永久不可见
- **GenericWeatherService 预报数组**：任一项非对象即整条请求失败（:104）
- **死代码/硬编码**：DeviceInfoProvider 无调用方；Splash "v1.0.0"；debug 局域网 IP 双处（AuthApi.kt:12 + WeatherWidget.kt:76）；Mock 主题列表

### 9.3 模型/服务/UI 层修复优先级（Top 10）

1. 天气 map 改 optString（控件静默消失）→ 2. 主题列表统一数据源（展示走本地 meta + themeId 关联）→ 3. Key 迁 EncryptedSharedPreferences + backup 排除规则 → 4. 控件级 JSON 容错（逐字段降级 + 解析警告日志）→ 5. Scanner 相机协程化串行 bind/unbind → 6. 列表 IO 移后台 → 7. 扫码 IP/port 校验 → 8. 相册/tile 解码采样 → 9. zip 炸弹防护 → 10. 清理死代码与硬编码

### 9.4 做得对的地方（演进基线）

FileUtils zip-slip 防护、PushReceiveManager SHA-256 + 断点续传 + 空间预检、WeatherWidget URL 归一化、JsonPath 数组索引、ColorParser 透明通道、FREE/GRID 双布局坐标兼容、LocationUtil 超时取消清理

---

## 十、全量缺陷清单（汇总）

### 🔴 高危（14 项）
| # | 问题 | 归属 |
|---|---|---|
| 1 | 断点续传协议断裂（跨端，两条路径都坏） | 协议 |
| 2 | PC 端忽略手机端失败响应（假成功） | 协议 |
| 3 | JSON-RPC 响应被误当握手（劫持/吞响应/死代码分支） | WebSocketManager |
| 4 | connect 不关旧 socket + 共享 handshakePending（双连接竞态） | WebSocketManager |
| 5 | 握手超时不关 socket → 双订阅双份推送 | WebSocketManager |
| 6 | PENDING_CONFIRM 被第二个 start 覆盖 | PushReceiveManager |
| 7 | chunk 静默丢弃不回 ack（PC 永久挂起） | PushReceiveManager |
| 8 | chunkIndex 被忽略（重发重复数据） | PushReceiveManager |
| 9 | open_link 无 scheme 校验/异常捕获（intent 注入面） | ThemeRenderViewModel |
| 10 | WebView AndroidView 未 destroy（泄漏） | 控件层 |
| 11 | MediaControl 插值键错配 + baseSystemTime=0 进度满条 | 控件层 |
| 12 | 天气控件 map getString 抛异常整体消失 | 模型层 |
| 13 | 主题列表双源冲突（已装主题打不开） | UI 层 |
| 14 | 凭据明文 + 备份外泄 | 安全 |

### 🟠 中危（18 项）
isAutoConnecting 残留 / 远程切主题无效 / mock 主题污染 / PENDING_CONFIRM 中断残留 / finalize 脱离同步锁 / 无限重连（后台耗电）/ requestId 非原子 / entered 补偿双发窗口 / themeSwitchEvent 丢事件 / listener 泄漏 / widgetData 只增不减 / JsonDataCache 串数据 / Shape 描边空心 / Gauge-Battery NaN / Clock nativeCanvas+60s 滞后 / 双天气管线 / Scanner 相机竞态 / 主线程 IO / 扫码注入 / 缓存位置无时效 / 配置回填竞态 / zip bomb / ImageLoader 全尺寸（详见各章）

### 🟡 低危（12 项）
LunarCalendar 2100 边界 / GenericWeatherService 预报数组 / 旧主题不可见 / DeviceInfoProvider 死代码 / 硬编码 IP/版本号 / Action 空 id / 布局兼容优先级 / GET_SIGNATURES 废弃 / 调试日志泄露证书 MD5 / isActive 假语义 / 手势互斥 / data:URI 不一致（详见各章）

---

## 十一、建议修复顺序（跨层）

**Phase 1（协议正确性，收益最大）**：缺陷 3/4/5（响应路由 + 连接单飞化）→ 缺陷 1/2（断点续传 + complete 检查）→ 缺陷 6/7/8（状态机 + chunk 校验）
**Phase 2（安全与泄漏）**：缺陷 14（备份外泄）→ 9（open_link）→ 10/11（WebView/MediaControl）
**Phase 3（数据一致性）**：13（双源）→ 12（天气 map）→ mock/双天气管线
**Phase 4（性能与清理）**：widgetData/JsonDataCache/ImageLoader/Scanner/主线程 IO → 死代码与硬编码清理
