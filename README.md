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

当前版本：v0.1.0-beta（第一版公测）

## 协议

本项目代码仅供学习参考，未经授权不得用于商业用途。