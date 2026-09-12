# 艾联猫 · Android 端

艾联猫是一套主题包联动工具：Windows 桌面端（Tauri）负责制作、管理与推送主题包，Android 端负责接收、渲染与交互。本仓库是 Android 端（Compose 单应用）。

![license](https://img.shields.io/badge/license-Apache--2.0-blue)

## 功能

- 局域网内与 PC 端自动配对（WebSocket，JSON-RPC 2.0，默认端口 9527）
- 接收 PC 端推送的主题包（分块传输 + SHA-256 校验 + 断点续传），后台安装
- 主题包渲染：网格 / 自由布局，17 种控件（时钟、天气、媒体控制、WebView、仪表、电池、日历……）
- 扫码 / 手动输入快速连接，自动重连
- 横竖屏自适应与安全区域适配

## 技术栈

- Kotlin + Jetpack Compose（MVVM，无 DI 框架）
- OkHttp WebSocket + org.json（不引入 JSON 库）
- CameraX 扫码、Coil 图片、CMake 原生签名校验
- Gradle 9.x / AGP / Kotlin 2.2

## 构建

```bash
# 需要 JDK 17+ 与 Android SDK
./gradlew :app:assembleDebug
# 单元测试
./gradlew :app:testDebugUnitTest
```

> 注：`gradle.properties` 支持通过 `RELEASE_STORE_FILE` 等属性配置 release 签名，见文件内注释。签名文件与口令不要提交到仓库。

## 与 PC 端联动

Android 端是纯"被控端"：连接、主题推送、媒体指令全部由 PC 端发起。协议为 WebSocket JSON-RPC 2.0：

- `theme.push.start / chunk / complete`：主题包推送
- `media.get_current / media_play_pause / ...`：媒体控制
- `launcher.open`、`action.execute`：应用与快捷操作

完整方法表与主题包 JSON 格式见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 关于 APK 签名校验

App 启动时通过原生模块（`app/src/main/cpp/native_signature.cpp`）校验自身签名，用于抑制"直接改 APK 重打包"的简单篡改。**注意两点**：

1. `EXPECTED` 数组中的 MD5 对应本项目自用签名。自行发布 release 时必须替换为你自己的证书 MD5，否则 release 包启动校验失败：
   ```bash
   # 用你的 release keystore 生成证书 MD5（16 字节），再填入 native_signature.cpp
   keytool -exportcert -alias <alias> -keystore <keystore> | openssl dgst -md5 -binary | xxd -i
   ```
2. 源码公开后，该校验只能防住"不懂原生层的重打包者"，**不能**作为安全边界。如果你不需要这个能力，删除 `nativeSignature` 相关构建配置与 `SignatureVerifier` 调用即可。

## 目录结构

```
app/src/main/java/com/ailinkcat/mobile/
├── data/          # 网络、存储、配置
├── domain/models/ # 主题包模型与 JSON 解析（跨端协议核心）
├── service/       # HTTP / 天气服务
├── ui/            # 页面、渲染引擎、控件渲染器、ViewModel
├── utils/         # 工具类
├── websocket/     # 连接与主题推送接收
└── cpp/           # 原生签名校验
```

## License

[Apache License 2.0](LICENSE)
