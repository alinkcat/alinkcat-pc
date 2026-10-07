# Android ↔ PC 数据对接协议文档

> 适用版本：PC 端 `alinkcat-pc` v0.1.x / Android 端 `ailinkcat` v1.0.x
> 协议：**JSON-RPC 2.0 over WebSocket**，默认端口 **9527**
> 架构：PC 端为**服务端**（监听局域网），Android 端为**客户端**（主动连接、被动接收）

---

## 一、连接拓扑（双连接架构）

Android 端会向 PC 端建立**两个独立的 WebSocket 连接**，各自独立握手、独立心跳、职责分离：

```
                         PC 端 (0.0.0.0:9527)
                    ┌──────────────────────────┐
                    │   WebSocketServer        │
                    │   (tokio-tungstenite)    │
                    └────────┬───────────┬────┘
                             │           │
              连接①主连接     │           │  连接②渲染连接
          (ConnectionViewModel)│         │ (ThemeRenderViewModel)
                             │           │
┌─────────────┐              │           │         ┌──────────────┐
│  Android     │── ws://PC_IP:9527 ──┐  ┌── ws://PC_IP:9527 ──│  Android     │
│  主界面       │   deviceName: "我的手机"│  │ deviceName: "我的手机 (Display)"│
│  (配置/推送页) │                  │  │                     │  (主题渲染页)  │
└─────────────┘                   │  │                     └──────────────┘
                                  │  │
     职责：配对 + 主题包推送接收    │  │  职责：theme.enter + monitor.subscribe
     (theme.push.*) + launcher/snippet│  + 接收 monitor.update / media.update
```

### 双连接职责划分

| | 连接① 主连接 | 连接② 渲染连接 |
|---|---|---|
| **所在 ViewModel** | `ConnectionViewModel`（配置页） | `ThemeRenderViewModel`（渲染页） |
| **设备名** | `deviceName`（原样，如"我的手机"） | `deviceName + " (Display)"`（**带后缀**） |
| **触发时机** | App 启动自动连接（autoConnect，3 次重试） | 进入主题渲染页时创建 |
| **主要请求** | `handshake`、`launcher.list`、`snippet.list` | `handshake`、`theme.enter`、`monitor.subscribe`、`media.get_current` |
| **接收推送** | `theme.push.start/chunk/complete`（主题包） | `monitor.update`（硬件数据）、`media.update`（媒体状态） |
| **生命周期** | 长连接，随配置页 ViewModel 存活 | 随渲染页存活，离开页面销毁 |

### 为什么是两个连接？

PC 端 `server.rs:380` 有**同名设备踢旧连接**逻辑（`device_name` 匹配则踢掉旧连接）。
渲染连接特意用 `" (Display)"` 后缀**避开互踢**，使两个连接可共存于同一 PC 服务端，各自独立订阅数据。

> ⚠️ **关键**：两个连接共用相同的 `ip:port:pairingCode`，但 `deviceName` 不同。若 PC IP 错误，**两个连接都会失败**。

### PC 端

- Tauri(Rust) 启动时在 `0.0.0.0:9527` 监听（端口被占用则依次尝试 9528~9531）
- 对每个连接一视同仁——都是 `clients` HashMap 里的一个 entry
- 通过 `theme.enter` / `monitor.subscribe` 区分谁要接收硬件数据推送

### Android 端

- OkHttp WebSocket 客户端，各自独立连接 `ws://{PC_IP}:{port}`
- 连接建立后**主动发送 handshake 请求**（携带配对码）
- 主连接有 3 次自动重试；渲染连接有 `scheduleReconnect` 重连机制

### 数据流向

- Android → PC：JSON-RPC **请求**（handshake / monitor.subscribe / theme.enter / action.execute 等）
- PC → Android：JSON-RPC **响应**（result/error）+ 主动**推送通知**（monitor.update / media.update / theme.push.*）

---

## 二、连接握手流程

### 2.1 二维码内容

PC 端将 `{ip, port, pairingCode}` 编码为二维码，Android 扫码后解析填充配置页。

### 2.2 握手时序（10 秒超时）

```
Android                          PC
  │                              │
  │── WS 连接 ws://IP:9527 ────▶│  TCP + WebSocket 升级
  │                              │
  │── handshake 请求(id=1) ────▶│  校验 pairingCode
  │                              │  生成 deviceId (UUID)
  │                              │  注册到 clients 表
  │◀── handshake 响应(id=1) ────│  result { status, deviceId, serverVersion, serverName, themeList }
  │                              │
  │   连接建立，进入双向消息泵      │
  │                              │
  │── theme.enter(id=N) ────────▶│  激活该客户端的 monitor + media 推送
  │◀── monitor.update(通知) ─────│  周期推送硬件数据（CPU/内存/磁盘/网络/电池）
  │◀── media.update(通知) ───────│  周期推送媒体播放状态
  │                              │
  │── theme.leave(id=N) ────────▶│  停止该客户端推送订阅
```

### 2.3 握手请求（Android → PC）

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "handshake",
  "params": {
    "deviceName": "我的 Android",
    "appVersion": "1.0.0",
    "pairingCode": "1234"
  }
}
```

### 2.4 握手响应（PC → Android）

**成功**：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "status": "ok",
    "serverVersion": "0.1.1",
    "serverName": "DESKTOP-XXX",
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "themeList": ["default", "dark"]
  }
}
```

**失败**（配对码错误）：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": { "code": -32001, "message": "Invalid pairing code" }
}
```

### 2.5 握手错误码

| code   | 含义             | 触发条件               |
|--------|------------------|------------------------|
| -32001 | 配对码错误       | pairingCode 不匹配      |
| -32002 | 握手超时         | 10 秒内未收到握手消息   |
| -32003 | 重复连接         | 同名设备重连，踢掉旧连接 |
| -32700 | 解析错误         | 非 JSON 文本           |
| -32601 | 方法不存在       | 首条消息 method ≠ handshake |
| -32602 | 参数无效         | 缺少 deviceName 等字段 |

### 2.6 心跳

Android 端 OkHttp WebSocket 每 **20 秒**发送 ping 帧，PC 端 tokio-tungstenite 自动响应 pong。

---

## 三、Android → PC 请求命令

握手通过后，Android 可向 PC 发送以下 JSON-RPC 请求：

| method              | 方向 | 说明                                         |
|---------------------|------|----------------------------------------------|
| `handshake`         | 请求 | 握手（仅连接首条）                           |
| `monitor.subscribe` | 请求 | 订阅指定数据源（cpu/memory/network/disk/uptime/battery） |
| `monitor.unsubscribe` | 请求 | 取消订阅                                     |
| `theme.enter`       | 请求 | 进入主题页：激活该客户端全部监控 + 媒体推送    |
| `theme.leave`       | 请求 | 离开主题页：停止该客户端推送                   |
| `media.execute`     | 请求 | 媒体控制（play/pause/next/prev/volume）       |
| `media.get_current`  | 请求 | 查询当前播放状态                             |
| `media.subscribe`   | 请求 | 订阅媒体状态变更推送                          |
| `media.unsubscribe` | 请求 | 取消媒体订阅                                 |
| `launcher.open`     | 请求 | 启动 PC 上指定应用/路径                       |
| `launcher.list`     | 请求 | 获取 PC 端快捷启动列表（宏面板数据源）         |
| `snippet.inject`    | 请求 | 向 PC 注入文本片段（剪贴板/键盘输入）          |
| `snippet.list`      | 请求 | 获取 PC 端文本片段列表（宏面板数据源）         |
| `action.execute`     | 请求 | 执行快捷面板动作（widgetId + action）         |

### 请求示例：宏面板数据（launcher.list / snippet.list）

```json
{ "jsonrpc": "2.0", "id": 10, "method": "launcher.list", "params": {} }
```

响应（`apps` 为数组，元素含 id/name/position；PC 本地图标路径不下发）：

```json
{ "jsonrpc": "2.0", "id": 10, "result": { "apps": [ { "id": "lnch-1728000000", "name": "QQ 音乐", "position": 0 } ] } }
```

```json
{ "jsonrpc": "2.0", "id": 11, "method": "snippet.list", "params": {} }
```

响应（`snippets` 为数组；数据来自 PC 前端「片段中心」经 `sync_snippets` 命令的同步）：

```json
{ "jsonrpc": "2.0", "id": 11, "result": { "snippets": [ { "id": "1", "label": "常用语", "content": "你好，世界" } ] } }
```

> `monitor.unsubscribe` 允许发送空 `params: {}`（服务端 `sources` 字段缺省视为空列表）。

### 请求示例：进入主题

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "theme.enter",
  "params": { "themeId": "perf-dashboard" }
}
```

响应：

```json
{ "jsonrpc": "2.0", "id": 2, "result": { "status": "ok", "active": true } }
```

---

## 四、PC → Android 推送通知

PC 端主动推送的消息**带 `method` 字段**（通知，不期待响应）。Android 端解析后渲染到主题组件。

### 4.1 monitor.update（硬件监控，周期推送）

进入主题后，PC 每 `interval`（默认 1~2s）推送一次：

```json
{
  "jsonrpc": "2.0",
  "method": "monitor.update",
  "params": {
    "cpu": 23.5,
    "memory": 45.2,
    "disk": 60.1,
    "network": { "upload": 12.3, "download": 45.6 },
    "upload": "12.3 KB/s",
    "download": "45.6 KB/s",
    "uptime": 3600,
    "battery": 85
  }
}
```

| 字段     | 类型             | 说明                                        |
|----------|------------------|---------------------------------------------|
| cpu      | number           | CPU 使用率 %                                |
| memory   | number           | 内存使用率 %                                |
| disk     | number           | 磁盘使用率 %                                |
| network  | object           | **标准字段**：`{upload, download}` 数值，单位 KB/s（Android 端按此解析） |
| upload   | string           | 旧版兼容字段（字符串带单位），新代码不要依赖 |
| download | string           | 旧版兼容字段（字符串带单位），新代码不要依赖 |
| uptime   | number           | 开机时长（秒）                              |
| battery  | number 或 object | 电量 %；或 `{level, charging, temperature}` |

> 数据源采集实现按平台区分：Windows 用 `GetSystemTimes`/`GlobalMemoryStatusEx` 等 Win32 API；macOS 用 Mach `host_statistics`。

### 4.2 media.update（媒体状态推送）

```json
{
  "jsonrpc": "2.0",
  "method": "media.update",
  "params": {
    "title": "Song Name",
    "artist": "Artist",
    "album": "Album",
    "isPlaying": true,
    "position": 120,
    "duration": 240,
    "thumbnail": "data:image/...",
    "displayMode": "full"
  }
}
```

> macOS 上媒体控制**无实现**（返回 `Err("非 Windows 环境不支持媒体控制")`），此推送在 macOS 上不会有数据。

### 4.3 theme.push.*（主题包推送，PC 主动发起）

PC 将本地主题包推送到 Android，采用**分块 + ACK** 机制：

| method              | 方向    | 说明                          |
|---------------------|---------|-------------------------------|
| `theme.push.start`  | PC→Android | 通知开始推送（含 size/hash/totalChunks） |
| Android→PC 响应     | 响应    | `{ status: "ready" }` 或 `{ status: "rejected" }` |
| `theme.push.chunk`  | PC→Android | 传输 base64 数据块（带 chunkIndex/isLast） |
| Android→PC 响应     | 响应    | chunk ACK                     |
| `theme.push.complete` | PC→Android | 推送完成通知                  |
| `theme.push.cancel`  | PC→Android | 取消推送                     |

#### theme.push.start

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "theme.push.start",
  "params": {
    "themeId": "my-theme",
    "name": "我的主题",
    "version": "1.0.0",
    "size": 102400,
    "totalChunks": 5,
    "hash": "sha256..."
  }
}
```

#### theme.push.chunk

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "theme.push.chunk",
  "params": {
    "themeId": "my-theme",
    "chunkIndex": 0,
    "data": "base64...",
    "isLast": false
  }
}
```

#### theme.push.complete

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "theme.push.complete",
  "params": { "themeId": "my-theme", "status": "ok" }
}
```

> 推送确认采用 AckBus 机制：PC 发送带 `id` 的通知，Android 回复相同 `id` 的 JSON-RPC 响应，PC 端 AckBus 消费确认。

---

## 五、PC 端 IP 获取逻辑（关键！）

PC 端通过 `get_local_ip` 命令获取本机局域网 IPv4 地址，用于生成扫码连接二维码。

### 5.1 当前实现

```rust
pub fn get_local_ip() -> Vec<String> {
    // 1) 枚举所有网卡 (local_ip_address::list_afinet_netifas)
    //    过滤回环 + 名字含 "lo" 的 → 收集所有非回环 IPv4
    // 2) 列表为空时回退到 UDP socket 探测 (connect 8.8.8.8 取本地地址)
}
```

### 5.2 平台差异（根因所在）

| 平台    | 网卡情况 | 结果 |
|---------|----------|------|
| Windows | 通常 1~2 个物理网卡（以太网/Wi-Fi） | ✅ 返回正确 IP |
| Android 模拟器 | 走 10.0.2.2 / localhost 回环 | ✅ 正常（连本机） |
| **macOS** | **大量虚拟网卡** | ❌ **见下** |

**macOS 上 `list_afinet_netifas()` 返回的典型接口列表：**

```
lo0          127.0.0.1        ← 已过滤
gif0         (无 IPv4)
stf0         (无 IPv4)
en0          192.168.1.100    ← ✅ 真实 Wi-Fi（需要的）
en1          (无 IPv4 / 雷电)
bridge100    192.168.64.1     ← ❌ Docker / Parallels 虚拟网桥
utun0~utun9  192.168.x.x / fd00::  ← ❌ VPN / iCloud Private Relay
llw0/awdl0   169.254.x.x      ← ❌ AirDrop 无线（链路本地）
```

当前过滤条件 `name.contains("lo")` **只挡了 lo0**，而 `bridge100`、`utun*`、`awdl0`、`llw0` 这些**虚拟网卡全部被收进 IP 列表**。

---

## 六、macOS 兼容性问题诊断

### 症状

- ✅ Windows 端 + Android 真机：正常接收数据
- ✅ Windows 端 + Android 模拟器：正常
- ❌ **macOS 端 + Android 真机：Android 收不到数据**

### 根因分析

#### 根因 1（主因）：IP 列表包含虚拟网卡，Android 连到错误地址

`get_local_ip()` 在 macOS 返回的 IP 列表形如：

```json
["192.168.64.1", "192.168.1.100", "169.254.x.x", "192.168.x.x"]
```

- 第一个可能是 `bridge100`（Docker/Parallels 网桥）或 `utun0`（VPN）的 IP
- Android 扫码后连接 `ws://192.168.64.1:9527`（Docker 网桥地址）→ **连不上 / 无数据**
- 真实的 Wi-Fi IP（192.168.1.100）排在后面，用户若没注意就选错了

#### 根因 2（次因）：macOS 防火墙拦截监听

macOS 首次运行应用监听 9527 端口时，系统会弹窗：
> "Do you want the application to accept incoming network connections?"

- 若用户点**「拒绝」**，应用被禁止接受传入 TCP 连接 → Android 无法连入
- 若点了「允许」但应用签名状态变化（如重新编译），防火墙规则可能失效

#### 根因 3（偶发）：macOS 私有网络权限

macOS 14+ 对应用的本地网络访问有额外隐私限制，首次可能需要授权。

### 诊断步骤

在 macOS 上执行（PC 端运行时）：

```bash
# 1. 确认 PC 端确实在监听 9527
lsof -i :9527

# 2. 查看 PC 真实局域网 IP（与手机同一网段的那个）
ifconfig | grep "inet " | grep -v 127.0.0.1

# 3. 手动用正确 IP 测试连通性（在手机上或 Mac 上）
curl -i http://<真实IP>:9527

# 4. 查看防火墙状态
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getappblocked $(which node) # 或应用的路径
```

### 修复方案

#### 方案 A：改进 IP 过滤逻辑（推荐，治本）

在 `get_local_ip()` 中增加虚拟网卡过滤，优先返回真实物理网卡：

```rust
pub fn get_local_ip() -> Vec<String> {
    let mut ips = Vec::new();
    if let Ok(list) = local_ip_address::list_afinet_netifas() {
        for (name, ip) in list {
            if ip.is_loopback() { continue; }
            if let std::net::IpAddr::V4(v4) = ip {
                let n = name.to_lowercase();
                // 过滤虚拟网卡：lo 回环、bridge(docker)、utun(vpn)、awdl/llw(airdrop)、veth、docker
                if n.contains("lo")
                    || n.contains("bridge")
                    || n.contains("utun")
                    || n.contains("awdl")
                    || n.contains("llw")
                    || n.contains("veth")
                    || n.contains("docker")
                { continue; }
                // 过滤链路本地地址（169.254.x.x）
                if v4.octets()[0] == 169 && v4.octets()[1] == 254 { continue; }
                ips.push(v4.to_string());
            }
        }
    }
    // 回退...
    if ips.is_empty() {
        if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
            if socket.connect("8.8.8.8:80").is_ok() {
                if let Ok(addr) = socket.local_addr() {
                    if let std::net::IpAddr::V4(v4) = addr.ip() {
                        ips.push(v4.to_string());
                    }
                }
            }
        }
    }
    ips
}
```

#### 方案 B：使用 UDP 探测作为主策略（简单可靠）

直接用 UDP `connect(8.8.8.8)` 探测本机出口 IP，跳过网卡枚举——这在所有平台上都能返回**实际能用的局域网 IP**：

```rust
pub fn get_local_ip() -> Vec<String> {
    let mut ips = Vec::new();
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                if let std::net::IpAddr::V4(v4) = addr.ip() {
                    ips.push(v4.to_string());
                }
            }
        }
    }
    // 枚举作为补充
    if ips.is_empty() {
        if let Ok(list) = local_ip_address::list_afinet_netifas() {
            for (name, ip) in list {
                if ip.is_loopback() || name.to_lowercase().contains("lo") { continue; }
                if let std::net::IpAddr::V4(v4) = ip { ips.push(v4.to_string()); }
            }
        }
    }
    ips
}
```

#### 方案 C：前端展示 IP 列表供用户选择

PC 端前端把 `get_local_ip()` 返回的列表全部展示，让用户选正确的那个生成二维码（而非默认取第一个）。

#### 方案 D：macOS 防火墙授权

系统设置 → 网络 → 防火墙 → 选项 → 将应用设为「允许传入连接」。
或命令行：

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)
```

### 推荐组合

**方案 A + 方案 D**：改进 IP 过滤逻辑（治本）+ macOS 防火墙授权（兜底）。

---

## 七、数据源映射（Android 主题组件）

Android 主题组件通过数据源名订阅 PC 推送的数据，对应关系：

| 数据源名                | 来源推送           | 字段         |
|-------------------------|--------------------|--------------|
| `system.cpu`            | monitor.update    | params.cpu   |
| `system.memory`         | monitor.update    | params.memory|
| `system.disk`           | monitor.update    | params.disk  |
| `system.network.upload` | monitor.update    | params.network.upload |
| `system.network.download` | monitor.update  | params.network.download |
| `system.uptime`         | monitor.update    | params.uptime|
| `system.battery`        | monitor.update    | params.battery|
| `media.title`           | media.update      | params.title |
| `media.artist`          | media.update      | params.artist|
| `media.isPlaying`       | media.update      | params.isPlaying|

---

## 八、断线与重连

- **心跳**：Android 端 20s ping，断线后 OkHttp 触发 `onFailure`
- **重连**：Android 端自动重连，重新发送 handshake
- **重复连接**：PC 端检测到同名设备重连，踢掉旧连接（发送 `-32003 Duplicate connection`），清理旧连接的 monitor/media 订阅
- **断开清理**：连接断开后，PC 端 Phase 3 清理该 client 的所有推送订阅，无订阅者时调度器自动 stop，防止孤儿任务

---

## 九、平台能力对照

| 功能         | Windows           | macOS                 | Linux   |
|--------------|-------------------|-----------------------|---------|
| 硬件监控     | ✅ Win32 API       | ✅ Mach host_statistics| ⚠️ 部分支持 |
| 媒体控制     | ✅ SMTC            | ❌ 无实现（返回错误）   | ❌ 无实现 |
| 应用启动     | ✅ `cmd /c start`  | ✅ `open -a`          | ✅ `xdg-open` |
| 键盘模拟     | ✅ enigo           | ✅ enigo（需辅助功能权限）| ✅ enigo |
| 剪贴板       | ✅ arboard         | ✅ arboard            | ✅ arboard |
| IP 获取      | ✅ 正常             | ❌ **虚拟网卡干扰**    | ⚠️ 需测试 |

---

## 十、快速排障清单

| 症状 | 检查 |
|------|------|
| Android 一直连接中/超时 | ① PC 和手机是否同一 Wi-Fi ② PC IP 是否正确（非虚拟网卡）③ macOS 防火墙是否放行 ④ 端口 9527 是否被占用 |
| 连接成功但收不到 monitor 数据 | ① 是否发送了 `theme.enter` ② PC 端 console 是否打印 `[Monitor] Pushing monitor.update` ③ macOS 上 Mach API 是否能读到 CPU 数据 |
| 媒体组件无数据 | macOS 不支持媒体控制（预期行为） |
| 主题推送失败 | ① 配对码是否正确 ② PC 端日志是否显示 `Rejected` ③ 网络是否稳定 |
| 配对码错误 | PC 端 `~/.ilinkcat/pairing_code.txt` 与 Android 输入是否一致 |
