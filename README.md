# 艾联猫 · ailinkcat Client

> PC 端主题包设计器 · Android 移动端渲染引擎 · 多端联动工具

艾联猫是一款面向 PC 与移动端联动的效率工具，提供主题包设计、硬件监控、媒体控制、快捷面板等功能。用户通过 PC 端编辑器创建个性化主题包，实时推送到手机端使用。

## 项目结构

```
alinkcat-Client/
├── alinkcat-pc/          # PC 桌面端（Tauri 2 + React 19 + Rust）
│   ├── src/              # React 前端（TypeScript）
│   ├── src-tauri/        # Rust 后端（WebSocket 服务器、硬件监控、媒体控制）
│   └── package.json
├── alinkcat-android/     # Android 移动端（Kotlin + Jetpack Compose）
│   ├── app/src/main/     # 应用源码
│   └── build.gradle.kts
├── alinkcat-module/      # Root 扩展模块（Magisk / KernelSU）
│   ├── bin/              # helper 入口
│   ├── scripts/          # 监控/动作/配置脚本
│   ├── config/           # 模块配置
│   └── META-INF/         # 模块安装引导
└── README.md
```

## 技术栈

| 平台 | 技术 |
|---|---|
| PC 桌面端 | Tauri 2 + React 19 + TypeScript + Ant Design 6 + zustand |
| Android 移动端 | Kotlin + Jetpack Compose + Material3 + OkHttp |
| 通信协议 | JSON-RPC 2.0 over WebSocket |
| 后端服务 | Spring Boot（云端，独立仓库） |

## 功能特性

- **主题包编辑器**：15 种组件、3 种布局（Grid/Free）、AI 辅助设计
- **WebSocket 实时推送**：PC 端编辑的主题包实时推送到手机端
- **硬件监控联动**：CPU、内存、磁盘、网络用量实时同步
- **媒体控制**：QQ 音乐等播放器状态同步与控制
- **主题市场**：浏览、下载、分享主题包
- **用户系统**：账号注册/登录、GitHub OAuth、积分会员

## 快速开始

### PC 端

```bash
cd alinkcat-pc
npm install
npm run tauri dev
```

### Android 端

在 Android Studio 中打开 `alinkcat-android/` 目录，同步 Gradle 后运行。

## 版本

当前版本：v0.1.1（公测）

## 协议与授权

### 开源协议

本项目代码基于 **GNU AGPL-3.0** 协议开源（完整文本见 [LICENSE](./LICENSE)）：

- 任何个人与组织均可自由使用、学习、修改与分发本项目代码；
- 修改或衍生作品分发时，**必须以 AGPL-3.0 同协议**开放完整源码；
- 将本项目代码（含修改版）**作为网络服务运营**时，必须向服务使用者提供完整源码（AGPL-3.0 第 13 条，网络交互同样适用）。

### 商标与品牌

「艾联猫」、`alinkcat`、`iLinkCat`、官方 logo 及官方域名 `top.atqx.cn` 为本项目所有者的名称与品牌标识，**不在 AGPL-3.0 授权范围内**。衍生项目与第三方服务不得使用上述名称、标识进行宣传，不得以任何方式暗示与官方存在关联或背书。

### 云服务授权

官方云端服务（主题商城、账号体系、推送中转等）**仅由本项目所有者运营**；官方发布的客户端仅连接官方服务端。未经本项目所有者**单独书面授权**：

- 不得运营使用本项目品牌的、面向公众的兼容云服务；
- 不得以规避 AGPL-3.0 开源义务的方式，将本项目用于云服务商业运营、闭源集成或 OEM 定制——如需上述用途，请联系作者获取**商业授权**（AGPL-3.0 之外的可选许可）。

联系渠道：GitHub Issues / 官网 https://top.atqx.cn

### 主题包与素材授权

主题包（`.alc`）、模板作品与用户创作素材**不属于本项目代码**，版权归各自创作者所有，默认以 **CC BY 4.0** 授权分享（创作者可在官方云对其作品另行约定）。本仓库内置的代码级模板与素材随代码同受 AGPL-3.0 约束。

Copyright © 2026 艾联猫（ailinkcat）作者