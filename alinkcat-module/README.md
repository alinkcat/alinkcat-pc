# 艾联猫 Root 扩展模块 (alinkcat-module)

> 面向已 Root 设备的艾联猫扩展能力层。兼容 Magisk（面具）、KernelSU（KSU）框架。

---

## 一、模块定位

艾联猫的正常使用场景是：PC 端通过 WebSocket 推送主题包、采集硬件监控数据、控制媒体播放。
在 **已 Root 的设备** 上，本模块能解锁**普通 App 无法访问**的深层能力：

| 能力 | 说明 |
|---|---|
| **深层硬件监控** | 读取真实 CPU 温控、电池电压/温度、充电电流、各核心频率、GPU 频率等（绕过 Android 权限限制） |
| **系统级脚本执行** | 通过 `su` 执行 shell 脚本，支持 `action.execute` 指令扩展为任意脚本 |
| **性能调度控制** | CPU 调频策略、GPU 调度、温控阈值建议（调度器需 root） |
| **应用内广播** | 收发系统广播，监听屏幕状态/充电状态用于主题联动 |
| **深层快捷操作** | 启动/停止任意系统服务、修改系统设置、模拟按键等（需用户授权） |
| **护眼/亮度控制** | root 级屏幕亮度、色温调节的替代通道 |

> ⚠️ 本模块**只提供能力通道**，具体执行动作始终由用户在 App 端确认授权后触发，不做无提示后台操作。

---

## 二、兼容框架

| 框架 | 版本 | 模块格式 |
|---|---|---|
| **Magisk（面具）** | v20.4+ | `magisk-module.zip`（标准格式） |
| **KernelSU** | v0.6+ | 与 Magisk 格式互通（`META-INF/com/google/android/update-binary` 兼容） |
| **APatch** | 建议兼容 | 采用 Magisk 标准 zip 布局 |

通用模块 zip 结构：

```
alinkcat-module.zip
├── module.prop                  # 模块元数据（框架解析）
├── customize.sh                 # 自定义安装脚本（内核返回安装结果）
├── post-fs-data.sh              # 启动早期 阶段脚本
├── service.sh                   # 服务启动阶段（守护进程/后台服务）
├── uninstall.sh                 # 卸载清理
├── META-INF/com/google/android/
│   ├── update-binary            # 框架安装器入口（标准）
│   ├── updater-script           # 安装脚本占位（框架处理）
├── system/                      # （可选）system 分区叠加文件
├── bin/                         # 存放辅助二进制
└── config/                      # 模块运行配置（用户可改）
```

---

## 三、目录结构

```
alinkcat-module/
├── META-INF/com/google/android/   # 框架识别安装入口
│   ├── update-binary
│   └── updater-script
├── bin/                           # 辅助二进制 / 脚本入口
│   ├── alinkcat_daemon            # 守护进程（可选）
│   └── alinkcat_helper            # 核心 helper 脚本
├── scripts/
│   ├── shell/
│   │   ├── monitor.sh             # 取深层硬件数据
│   │   ├── action.sh              # 执行动作（脚本/按键/服务）
│   │   ├── power.sh               # 性能调度/温控
│   │   └── config.sh              # 读写模块配置
│   ├── post-fs-data.sh            # Magisk 阶段：后期 FS 挂载
│   ├── service.sh                 # Magisk 阶段：启动后台
│   └── uninstall.sh               # 卸载钩子
├── config/
│   └── module.conf                # 模块配置（白名单/开关）
├── system/                        # system 叠加（默认为空）
├── src/
│   └── native/                    # 未来原生扩展（C/Rust，可选）
├── doc/
│   ├── ARCHITECTURE.md
│   └── PROTOCOL.md
├── module.prop                    # 模块元数据
├── customize.sh                   # 安装回调
├── build.sh                       # 打包脚本
├── README.md                      # 模块说明
└── .gitignore
```

---

## 四、核心文件设计

### 4.1 `module.prop`（模块身份）

```ini
id=alinkcat_module
name=艾联猫 Root 扩展
version=v1.0
versionCode=1
author=艾联猫
description=艾联猫在已 Root 设备上的深层扩展能力：深层硬件监控、脚本执行、性能调度、系统级快捷操作。
minMagisk=20400
updateJson=https://example.com/alinkcat-module/update.json
```

### 4.2 `customize.sh`（安装逻辑）

```sh
#!/system/bin/sh
# 艾联猫模块安装脚本
SKIPUNZIP=0
MODPATH="${0%/*}"

# 解析用户自定义安装选项
if [ "$KSU" = "true" ]; then
  ui_print "- KernelSU 环境检测到"
fi

# 检查依赖
command -v su >/dev/null 2>&1 || { ui_print "! 未检测到 su"; exit 1; }

# 解压并放置脚本
ui_print "- 安装艾联猫模块脚本..."
cp -f "$MODPATH/scripts/"* "$MODPATH/" 2>/dev/null || true

# 设置可执行权限
chmod 0755 "$MODPATH/bin/alnkcat_helper" "$MODPATH/scripts/"*.sh 2>/dev/null || true

# 写入默认配置（若不存在）
[ -f "$MODPATH/config/module.conf" ] || cp "$MODPATH/config/module.conf.example" "$MODPATH/config/module.conf" 2>/dev/null || true

ui_print "- 艾联猫模块安装完成"
```

### 4.3 `service.sh`（后台服务入口）

```sh
#!/system/bin/sh
# 艾联猫模块服务 —— 在系统启动后运行，负责拉起守护进程
MODDIR=${0%/*}
[ -f "$MODDIR/bin/alnkcat_helper" ] || exit 1

# 延迟启动，等待系统稳定
sleep 5

# 后台启动守护（脱分离）
"$MODDIR/bin/alnkcat_helper" daemon >/dev/null 2>&1 &
```

### 4.4 `bin/alnkcat_helper`（核心 helper）

这是一个 shell 实现的统一入口，负责鉴权、白名单、能力分发：

```sh
#!/system/bin/sh
# alnkcat helper —— 统一入口
# 用法: alnkcat_helper <cmd> [args...]

VERSION="1.0.0"
CONF="/data/adb/modules/alinkcat_module/config/module.conf"
ALLOWED_APPS="com.ailinkcat.mobile"

# 加载配置
[ -f "$CONF" ] && . "$CONF"

# 鉴权：检查调用者是否为艾联猫 App
check_caller() {
  # 通过 su 调用时 caller 不易获取，简化：通过 IPC 白名单校验（App 端传 secret）
  local secret="$1"
  [ "$secret" = "$MODULE_SECRET" ] || { echo "permission denied" >&2; exit 1; }
}

case "$1" in
  version) echo "alinkcat-module $VERSION" ;;
  daemon)  # 守护进程：循环监听事件（可选）
    while true; do
      # 监听广播 / socket 指令
      sleep 5
    done ;;
  monitor) # 深层硬件数据: alnkcat_helper monitor cpu temp
    shift
    . "$MODPATH/scripts/shell/monitor.sh"
    get_${1:-all} "${@:2}" ;;
  action) # 执行动作: alnkcat_helper action <type> <args...>
    shift
    check_caller "$1" || exit 1
    . "$MODPATH/scripts/shell/action.sh"
    run_action "${@:2}" ;;
  config) # 读写配置
    shift
    . "$MODPATH/scripts/shell/config.sh"
    edit_config "$@" ;;
  *) echo "usage: alnkcat_helper <version|daemon|monitor|action|config>" ;;
esac
```

### 4.5 `config/module.conf`（模块配置）

```sh
# 艾联猫模块配置
# 由 App 端通过 alnkcat_helper config 或手动编辑

# 通话密钥（App <-> Helper 鉴权）
MODULE_SECRET="change_me"

# 允许执行动作的应用白名单（包名空格分隔）
ALLOWED_APPS="com.ailinkcat.mobile"

# 功能开关
ENABLE_MONITOR=1          # 深层硬件监控
ENABLE_ACTION=1           # 脚本/动作执行
ENABLE_POWER=0            # 性能调度（默认关，呼性能风险）
ENABLE_ACCESSIBILITY=0    # 模拟操作（默认关）
```

### 4.6 `scripts/shell/action.sh`（动作执行）

```sh
#!/system/bin/sh
# 动作执行核心
# run_action <type> <args...>

run_action() {
  local type="$1"; shift
  case "$type" in
    "shell")        # 执行任意 shell 脚本
      sh -c "$*" ;;
    "service")      # 启动/停止系统服务
      local svc="$1"; local op="${2:-start}"
      case "$op" in
        start)  /system/bin/start "$svc" 2>/dev/null ;;
        stop)   /system/bin/stop "$svc" 2>/dev/null ;;
        restart) /system/bin/restart "$svc" 2>/dev/null ;;
      esac ;;
    "settings")     # 修改系统设置
      local ns="$1"; local key="$2"; local value="$3"
      settings put "$ns" "$key" "$value" ;;
    "brightness")   # 亮度控制（root 级）
      echo "$1" > /sys/class/backlight/*/brightness 2>/dev/null ;;
    *) echo "unsupported action: $type" >&2 ;;
  esac
}
```

### 4.7 `scripts/shell/monitor.sh`（深层监控）

```sh
#!/system/bin/sh
# 深层硬件数据获取

get_cpu() {
  case "$2" in
    temp)
      # 读 CPU 温度（不同设备的节点不同）
      for f in /sys/class/thermal/thermal_zone*/temp; do
        [ -f "$f" ] && cat "$f" 2>/dev/null && break
      done ;;
    freq) cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq 2>/dev/null ;;
    all)
      echo "cpu_usage: $(get_cpu_usage)"
      echo "cpu_temp: $(get_cpu temp)"
      echo "cpu_freq: $(get_cpu freq)"
      ;;
  esac
}

get_battery() {
  case "$2" in
    volt) cat /sys/class/power_supply/battery/voltage_now 2>/dev/null ;;
    temp) cat /sys/class/power_supply/battery/temp 2>/dev/null ;;
    current)
      cat /sys/class/power_supply/battery/current_now 2>/dev/null ||
      cat /sys/class/power_supply/battery/batt_current 2>/dev/null ;;
    all)
      echo "voltage: $(get_battery volt)"
      echo "temperature: $(get_battery temp)"
      echo "current: $(get_battery current)"
      ;;
  esac
}

get_all() {
  echo "== CPU =="; get_cpu all
  echo "== Battery =="; get_battery all
  echo "== Memory =="
  cat /proc/meminfo
  echo "== GPU =="
  cat /sys/class/kgsl/kgsl-3d0/gpuclk 2>/dev/null || \
  cat /sys/class/misc/mali0/device/devfreq/*/cur_freq 2>/dev/null || true
}
```

### 4.8 `uninstall.sh`（卸载钩子）

```sh
#!/system/bin/sh
# 艾联猫模块卸载
MODDIR=${0%/*}

# 停止守护进程
kill $(pgrep -f alnkcat_helper) 2>/dev/null || true

# 清理 App 侧生成的配置/缓存
rm -rf /data/local/tmp/alinkcat_module 2>/dev/null
rm -f /data/adb/service.d/alinkcat-module.sh 2>/dev/null

ui_print "- 艾联猫模块已卸载"
```

---

## 五、打包脚本 `build.sh`

```sh
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

VERSION="v1.0.0"
OUT="dist/alinkcat-module-${VERSION}.zip"

rm -rf dist && mkdir -p dist

# 打包成标准 Magisk/KSU 模块 zip
zip -r "$OUT" \
  module.prop customize.sh service.sh uninstall.sh \
  scripts bin config system \
  META-INF \
  -x "*.DS_Store" "dist/*" "doc/*" "src/*"

echo "✔ 构建完成: $OUT"
```

---

## 六、与主项目的接入方式

### App 端调用路径

```
艾联猫 App (com.ailinkcat.mobile)
  └─ RootHelper (未来在 alinkcat-android 中开发)
       ├─ 检测 root:  `which su` / 尝试执行
       ├─ 检查模块:  `su -c "test -f /data/adb/modules/alinkcat_module/bin/alnkcat_helper"`
       ├─ 调用 helper: `su -c "alnkcat_helper monitor cpu temp <secret>"`
       └─ 解析输出:  JSON/纯文本
```

### 能力发现协议（建议）

App 端启动时调用 `alnkcat_helper version` 和 `alnkcat_helper capabilities`，
验证模块版本与可用能力，返回：

```
alinkcat-module 1.0.0
capabilities: monitor action config
```

### 安全设计

1. **Secret 鉴权**：helper 执行敏感动作需携带 `MODULE_SECRET`（安装时随机生成，App 无法直接读取）
2. **包名白名单**：`ALLOWED_APPS` 限制可调用方
3. **默认关闭**：性能调度、模拟操作默认关闭，需 App 端显式请求
4. **无静默后台操作**：所有动作由用户在 App 内确认

---

## 七、后续规划

- [ ] **RootHelper Kotlin 类**：在 alinkcat-android 中实现 su 调用 / 模块检测 / 结果解析
- [ ] **能力协商协议**：`capabilities`、`native socket`（绕过每次 exec su 的开销）
- [ ] **原生 socket 守护**：`alnkcat_daemon` 改为监听本地 socket，App 长连接，避免反复 exec
- [ ] **Web 面板**：可选，通过本地 HTTP 服务查看模块状态
- [ ] **自动更新**：接入 `updateJson` 模块自动更新
- [ ] **更多监控项**：GPU 频率、传感器、存储温度等

---

## 八、参考文档

- Magisk Developer Guides: https://topjohnwu.github.io/Magisk/guides.html
- KernelSU 模块开发: https://kernelsu.org/guide/module.html
- Magisk 模块 Props: module.prop 规范
---

## 九、开源协议

本模块随 alinkcat 项目整体基于 **GNU AGPL-3.0** 协议开源（完整文本见仓库根目录 `LICENSE`）。修改或衍生作品分发时必须以同协议开源。「艾联猫」「alinkcat」及官方 logo / 域名为受保护的品牌标识；云服务商业运营或闭源集成需获取单独商业授权，详见仓库根 README 的「协议与授权」章节。
