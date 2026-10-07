# 艾联猫主题素材下载脚本使用说明

> 配套 `download-assets.ps1`。AI 会为每个主题生成一份 `assets-manifest.json` 素材清单，
> 你运行脚本即可批量下载，**下载成功后自动移动到主题包对应的 assets 目录**。

---

## 快速开始

### 1. 准备

把 AI 生成的素材清单（如 `assets-manifest.json`）和脚本放在同一个目录，或任意目录。

### 2. 运行（二选一）

```powershell
# 方式一：批量下载清单里的全部素材（推荐）
.\download-assets.ps1 -Manifest assets-manifest.json

# 方式二：下载单个素材
.\download-assets.ps1 -Url "https://example.com/bg.png" -File "bg.png" -Dest "themes\my-theme\assets"
```

> ⚠️ **首次运行若提示「禁止运行脚本」**，是因为系统执行策略为 Restricted，
> 用下面任一种方式解决：
>
> ```powershell
> # 方式A：仅本次绕过（推荐，不改系统设置）
> powershell -NoProfile -ExecutionPolicy Bypass -File .\download-assets.ps1 -Manifest assets-manifest.json
>
> # 方式B：给当前用户放开（一劳永逸）
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

---

## 素材清单格式（assets-manifest.json）

AI 生成的清单长这样：

```json
{
  "assets": [
    {
      "file": "background.png",
      "url": "https://i.imgur.com/xxxxx.png",
      "dest": "themes\\cyberpunk-monitor\\assets",
      "minSize": 10000
    },
    {
      "file": "anim.gif",
      "url": "https://media.giphy.com/media/xxxxx/giphy.gif",
      "dest": "themes\\cyberpunk-monitor\\assets"
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|------|:----:|------|
| `file` | ✅ | 保存的文件名（含扩展名） |
| `url` | ✅ | 素材下载地址 |
| `dest` | ❌ | 目标目录；相对路径基于 `-BaseDir`（默认脚本所在目录），省略则存到 BaseDir |
| `minSize` | ❌ | 最小字节数；下载结果小于该值视为失败（防止下载到空白页/错误页） |

> 💡 `dest` 建议写 `themes\{主题ID}\assets`，正好对上 PC 端主题包的资源目录
> （`~/.ilinkcat/themes/{主题ID}/assets/`）。

---

## 常用参数

| 参数 | 默认 | 说明 |
|------|------|------|
| `-Manifest` | - | 清单 JSON 路径 |
| `-BaseDir` | 当前目录 | 相对 dest 的基准目录 |
| `-Retry` | 3 | 失败重试次数 |
| `-Timeout` | 30 | 单次请求超时（秒） |
| `-UserAgent` | Chrome | 自定义 UA（防某些站防盗链） |
| `-SkipCheck` | 关 | 跳过「返回 HTML 视为失败」检测 |

---

## 行为说明

- **下载先写临时文件**（`xxx.part`），**全部成功后自动移动**到目标目录，不会留下半截文件
- **自动检测防盗链**：服务器返回 `text/html`（登录墙/错误页）时判定失败并重试
- **minSize 校验**：小于指定字节数视为失败（可挡住空响应）
- 失败项会在汇总中列出，可重跑脚本（已成功的会跳过/覆盖）

---

## 常见问题

**Q: 某些素材一直失败？**
可能原因：链接失效、防盗链（需 Referer）、被墙。可先浏览器打开 URL 确认可达；
实在下不了的告诉我，我会替换成可用的免版权源（Pexels / Unsplash / Giphy 等）。

**Q: 下载完怎么确认位置对？**
主题包资源路径 = `C:\Users\你的用户名\.ilinkcat\themes\{主题ID}\assets\`。
AI 会在主题交付时附上「素材落位检查清单」，你按清单核对即可。
