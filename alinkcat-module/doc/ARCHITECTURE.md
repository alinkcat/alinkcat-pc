# 艾联猫 Root 模块架构

> 本文档描述 alinkcat-module 的架构、通信协议与安全模型。

## 一、整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Android App                            │
│              (com.ailinkcat.mobile)                       │
│                                                           │
│   RootHelper (Kotlin)                                     │
│    ├─ 检测 root / 模块存在                                │
│    ├─ 调用: su -c "sh alnkcat_helper <cmd> ..."          │
│    └─ 解析输出 (文本/JSON)                                │
└──────────────────────────┬──────────────────────────────┘
                           │ su
┌──────────────────────────▼──────────────────────────────┐
│                  Magisk / KernelSU                       │
│              /data/adb/modules/alinkcat_module/          │
│                                                           │
│   bin/alnkcat_helper ── 统一入口 (鉴权 / 分发)            │
│     ├─ monitor.sh   ── 深层硬件监控 (CPU/电池/GPU/内存)   │
│     ├─ action.sh    ── 动作执行 (shell/服务/设置/亮度)    │
│     ├─ config.sh    ── 配置读写                          │
│     └─ service.sh   ── 开机自启守护                      │
└─────────────────────────────────────────────────────────┘
```

## 二、模块 zip 布局（Magisk/KSU 兼容）

```
alinkcat-module.zip
├── module.prop                    # 元数据
├── customize.sh                   # 安装脚本
├── service.sh                     # 开机服务
├── uninstall.sh                   # 卸载
├── post-fs-data.sh                # 早期挂载钩子
├── META-INF/com/google/android/
│   ├── update-binary              # #MAGISK 引导
│   └── updater-script
├── bin/alnkcat_helper             # 入口
├── scripts/shell/*.sh             # 功能实现
├── config/module.conf             # 配置
└── system/                        # 联合文件系统
```

## 三、CLI 协议

App 端通过 `su -c` 调用，输出为文本行。

| 命令 | 示例 | 说明 |
|---|---|---|
| `version` | `alinkcat-module 1.0.0` | 模块版本 |
| `capabilities` | `capabilities: monitor action config` | 可用能力 |
| `monitor cpu temp` | `42°C` | 深层监控 |
| `action shell <secret> '命令'` | — | 执行脚本 (需密钥) |
| `config set <key> <value>` | `ok` | 读写配置 |
| `secret` | `alinkcat_123456` | 获取通信密钥 |

## 四、安全模型

| 层 | 机制 | 目的 |
|---|---|---|
| su 门禁 | Magisk/KSU 自带 su 助手 | 所有调用需 root 授权 |
| 密钥鉴权 | `MODULE_SECRET` | 区分 App 与恶意调用 |
| 包名白名单 | `ALLOWED_APPS` | 限制可调用方 |
| 功能开关 | `ENABLE_POWER` 等 | 高权限能力默认关闭 |
| 用户确认 | App 内弹窗确认 | 无静默后台操作 |

> ⚠️ 安全边界：`alnkcat_helper` 运行在 root 环境，务必通过
> 密钥 + 白名单双校验，避免被任意应用调用 root 能力。

## 五、关键目录访问

| 路径 | 用途 |
|---|---|
| `/data/adb/modules/alinkcat_module/` | 模块安装目录 |
| `/data/adb/modules/alinkcat_module/config/module.conf` | 配置 |
| `/data/local/tmp/alinkcat_module/` | App 临时数据 |
| `/data/adb/service.d/` | 开机服务（备用） |

## 六、后续演进

- [ ] RootHelper Kotlin：su 调用封装、模块检测、输出解析
- [ ] 原生 socket 守护：替代每次 exec su 的开销
- [ ] 结构化输出（JSON）替代文本流
- [ ] 自动更新（updateJson）
- [ ] 更多监控项：GPU 频率、传感器、存储温度
- [ ] 性能调度接口（CPU 调频策略）