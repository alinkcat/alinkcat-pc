# Alink Cat (ailinkcat) Theme System Design Document

> This document presents the open-source theme design and serves as a reference for the backend theme documentation page.
> It describes the complete data model, widget specification, editor, packaging, and push protocol for PC theme packages (`.alc`).

---

## 1. Theme System Overview

The theme system is the core feature of Alink Cat, defining "how information is displayed and interacted with on the phone." A **theme package (Theme)** consists of multiple **pages (Page)**; each page contains several **widgets (Widget)** that provide specific content and functionality.

### 1.1 Core Concepts

| Concept | Description |
|------|------|
| **Theme package (Theme)** | An `.alc` package containing `theme.json` metadata and resource files (images, icons, etc.) |
| **Page (Page)** | A screen in the theme with its own layout and background |
| **Layout (Layout)** | How a page is arranged: grid / list / free |
| **Widget (Widget)** | The smallest functional unit on a page; 15 types are supported |
| **Asset (Asset)** | Image/icon files referenced by widgets; deduplicated centrally |

### 1.2 Data Flow

```
PC editor (build theme) → save as theme.json + assets → package .alc
                                             ↓
                                WebSocket push protocol (chunked + ack)
                                             ↓
                           Phone receives → decompress → render theme
```

---

## 2. Theme Package File Structure

### 2.1 Storage Directory

Themes are stored under `~/.ilinkcat/themes/{themeId}/`:

```
~/.ilinkcat/themes/
├── {themeId}/
│   ├── theme.json          # Theme metadata (core)
│   ├── cover.png           # Theme cover (optional)
│   ├── assets/             # Shared image assets
│   │   └── {hash}.png
│   └── icons/              # SVG icon assets
│       └── {hash}.svg
└── ...
```

The top-level `~/.ilinkcat/config.json` stores the app configuration (currently active theme, command allowlist).

### 2.2 Package Format (.alc)

`.alc` (Alink Cat Zip) is essentially a **ZIP archive** that uses Deflate compression and contains `theme.json` along with all resource files. After packaging, it is **Base64**-encoded for transport.

---

## 3. Data Model (JSON Schema)

### 3.1 ThemeMeta (Theme Metadata)

```json
{
  "id": "perf-dashboard",
  "name": "性能仪表盘",
  "version": "1.0.0",
  "author": "艾联猫",
  "description": "实时监控系统性能",
  "preview": "预览图路径",
  "source": "local|downloaded|market",
  "market_id": "市场ID",
  "downloaded_at": "下载时间",
  "pages": []
}
```

| Field | Type | Required | Description |
|------|------|------|------|
| `id` | string | ✅ | Unique theme identifier; cannot contain `/`, `\`, or `..` |
| `name` | string | ✅ | Theme name |
| `version` | string | ✅ | Version number |
| `author` | string | ✅ | Author |
| `description` | string | ❌ | Description |
| `preview` | string | ❌ | Preview image |
| `source` | string | ❌ | Source: `local`/`downloaded`/`market` |
| `market_id` | string | ❌ | Marketplace ID |
| `downloaded_at` | string | ❌ | Download time |
| `pages` | array | ✅ | List of pages; at least 1 |

### 3.2 PageDefinition (Page)

```json
{
  "id": "page-1",
  "label": "主页",
  "layout": {
    "type": "grid",
    "columns": 4,
    "rows": 6,
    "backgroundColor": "#ffffff",
    "backgroundImage": "assets/bg.png",
    "backgroundMode": "cover",
    "backgroundOpacity": 100
  },
  "widgets": []
}
```

| Field | Type | Description |
|------|------|------|
| `id` | string | Unique page identifier |
| `label` | string | Page name |
| `layout.type` | string | Layout type: `grid`/`list`/`free` |
| `layout.columns` | number | Number of grid columns (grid layout) |
| `layout.rows` | number | Number of grid rows (grid layout) |
| `backgroundColor` | string | Page background color |
| `backgroundImage` | string | Page background image (path or data URL) |
| `backgroundMode` | string | `cover`/`contain`/`stretch`/`repeat` |
| `backgroundOpacity` | number | Background opacity 0-100 |
| `widgets` | array | Widget list |

### 3.3 WidgetDefinition (Common Widget Fields)

All widgets share the following fields:

```json
{
  "id": "w-xxx",
  "type": "button",
  "label": "快捷键",
  "gridCol": 0, "gridRow": 0, "gridW": 1, "gridH": 1,
  "freeX": 10, "freeY": 10, "freeW": 30, "freeH": 15,
  "borderRadius": 6,
  "backgroundColor": "#f0f2f5",
  "backgroundOpacity": 100,
  "textColor": "#333333",
  "fontSize": 12,
  "fontWeight": "normal"
}
```

| Field | Type | Description |
|------|------|------|
| `id` | string | Unique widget identifier |
| `type` | string | Widget type (see Chapter 4) |
| `label` | string | Display name |
| `gridCol` / `gridRow` | number | Position in grid layout |
| `gridW` / `gridH` | number | Size in grid layout |
| `freeX` / `freeY` | number | Position in free layout (percentage) |
| `freeW` / `freeH` | number | Size in free layout (percentage) |
| `borderRadius` | number | Corner radius |
| `backgroundColor` | string | Background color |
| `backgroundOpacity` | number | Background opacity 0-100 |
| `textColor` | string | Text color |
| `fontSize` | number | Font size |
| `fontWeight` | string | `normal`/`bold`/`bolder` |

> Each widget stores its specialized properties in the flattened `extra` field.

---

## 4. Widget Specification

There are **15 widget types**, identified by `type`. The following sections define the properties specific to each type.

### 4.1 Button (`button`)

Triggers quick actions (keyboard shortcuts, app launches, etc.).

| Field | Type | Default | Description |
|------|------|------|------|
| `icon` | string | 🔘 | Icon (Emoji or SVG) |
| `action.type` | string | keyboard | Action type: `keyboard`/`launcher`/`command` |
| `action.keys` | array | [] | Keyboard key combination |

### 4.2 Gauge (`gauge`)

Displays a single metric (e.g. CPU usage).

| Field | Type | Default | Description |
|------|------|------|------|
| `dataSource` | string | system.cpu.usage | Data source (subscription path) |
| `unit` | string | % | Unit |
| `gaugeStyle` | string | ring | Style: `ring` / `number` / `bar` |
| `minValue` / `maxValue` | number | 0 / 100 | Value range |
| `ringColorLow` | string | #52c41a | Low-value color |
| `ringColorMid` | string | #faad14 | Mid-value color |
| `ringColorHigh` | string | #ff4d4f | High-value color |
| `ringWidth` | number | 3 | Ring width |

### 4.3 Snippet List (`snippet-list`)

Displays quick-input content (customer service scripts, etc.).

| Field | Type | Default | Description |
|------|------|------|------|
| `snippets` | array | [] | Array of snippets `{id, label, content}` |
| `mode` | string | note | Mode: `note`, etc. |

### 4.4 Image (`image`)

| Field | Type | Default | Description |
|------|------|------|------|
| `src` | string | '' | Image path or data URL |
| `objectFit` | string | cover | Fit mode: `cover`/`contain`/`fill` |

### 4.5 Text Label (`text`)

| Field | Type | Default | Description |
|------|------|------|------|
| `content` | string | 双击编辑文字 | Text content |
| `textAlign` | string | left | Alignment: `left`/`center`/`right` |
| `color` | string | #333333 | Text color |
| `padding` | number | 4 | Inner padding |

### 4.6 Shape (`shape`)

| Field | Type | Default | Description |
|------|------|------|------|
| `shapeType` | string | rect | `rect`/`circle`/`line`, etc. |
| `fillType` | string | solid | `solid`/`gradient`/`none` |
| `fillColor` | string | #d9d9d9 | Fill color |
| `gradientStart` | string | #4F6EF7 | Gradient start color |
| `gradientEnd` | string | #52c41a | Gradient end color |
| `gradientAngle` | number | 90 | Gradient angle |
| `borderColor` | string | transparent | Border color |
| `borderWidth` | number | 0 | Border width |
| `opacity` | number | 100 | Opacity |

### 4.7 Web View (`webview`)

Supports three data source types (webpage, RSS, JSON) along with presets.

| Field | Type | Default | Description |
|------|------|------|------|
| `url` | string | '' | Webpage URL |
| `showScrollbar` | boolean | true | Show scrollbar |
| `displayMode` | string | webpage | `webpage`/`rss`/`json`/`always`/`playing_only` |
| `rssUrl` | string | '' | RSS feed URL |
| `jsonUrl` | string | '' | JSON API URL |
| `refreshInterval` | number | 0 | Refresh interval (seconds) |
| `titleField` | string | title | JSON/RSS title field |
| `descField` | string | description | Description field |
| `timeField` | string | pubDate | Time field |
| `linkField` | string | link | Link field |
| `preset` | string | none | Preset: `none`/`bilibili`/`weather` |
| `bilibiliRoomId` | string | '' | Bilibili live room ID |
| `weatherCity` | string | '' | Weather city |
| `weatherApiKey` | string | '' | Weather API key |
| `weatherUnit` | string | c | Temperature unit: `c`/`f` |

### 4.8 Media Control (`media-control`)

Controls media playback on the phone (QQ Music, etc.).

| Field | Type | Default | Description |
|------|------|------|------|
| `displayMode` | string | always | `always`/`playing_only` |
| `showCover` | boolean | true | Show cover art |
| `showProgress` | boolean | true | Show progress bar |

### 4.9 System Monitor (`system-monitor`)

| Field | Type | Default | Description |
|------|------|------|------|
| `showCPU` | boolean | true | Show CPU |
| `showMemory` | boolean | true | Show memory |
| `showDisk` | boolean | true | Show disk |
| `showNetwork` | boolean | true | Show network |
| `refreshInterval` | number | 2 | Refresh interval (seconds) |

### 4.10 Quick Action Panel (`quick-action`)

| Field | Type | Default | Description |
|------|------|------|------|
| `columns` / `rows` | number | 2 / 2 | Grid size |
| `cells` | array | [] | Cell array; each cell has a type (launcher/snippet), name, path, and content |

### 4.11 Launcher (`launcher`)

| Field | Type | Default | Description |
|------|------|------|------|
| `name` | string | 计算器 | App name |
| `path` | string | calc | App path / command |
| `icon` | string | 📱 | Icon |

### 4.12 Clock (`clock`)

| Field | Type | Default | Description |
|------|------|------|------|
| `format24h` | boolean | true | 24-hour format |
| `showSeconds` | boolean | true | Show seconds |
| `showAmpm` | boolean | true | Show AM/PM in 12-hour mode |

### 4.13 Date (`date`)

| Field | Type | Default | Description |
|------|------|------|------|
| `dateFormat` | string | YYYY年MM月DD日 星期X | Date format (supports YYYY/MM/DD/星期X) |
| `showLunar` | boolean | true | Show lunar calendar |

### 4.14 Calendar (`calendar`)

| Field | Type | Default | Description |
|------|------|------|------|
| `viewMode` | string | month | `month` (month view) / `week` (week view) |
| `highlightToday` | boolean | true | Highlight today |

### 4.15 Icon (`icon`)

Acts only as an icon placeholder; its properties are the same as the `icon` section of `button`.

---

## 5. Layout Modes

### 5.1 Grid Layout (grid)

- The page is divided into a `columns × rows` grid
- Widgets are positioned via `gridCol`/`gridRow`/`gridW`/`gridH`
- Suited for regular arrangements

### 5.2 List Layout (list)

- Widgets are stacked vertically, each taking one row
- Suited for information feeds (snippets, RSS, media)

### 5.3 Free Layout (free)

- Widgets are precisely positioned via `freeX`/`freeY`/`freeW`/`freeH` (percentages)
- Suited for fine-grained design; supports snap alignment

---

## 6. PC Theme Editor

### 6.1 Features

| Feature | Description |
|------|------|
| Page management | Add / delete / reorder pages, switch layout modes |
| Widget library | Drag-and-drop to add any of the 15 widget types |
| Property panel | Edit a selected widget's specialized properties |
| Canvas preview | Phone mockup (default landscape 16:9), supports zoom / snap |
| File operations | Save / export / import theme packages |
| AI assist | AI panel can help generate / edit themes (collapsed by default) |

### 6.2 Editor Default State

- The phone mockup defaults to **landscape** (16:9)
- The AI panel is **collapsed** by default; double-click the title bar to expand
- Default widget style: background `#f0f2f5`, text `#333333`, font size 12, corner radius 6

---

## 7. Resource Management (Data Reuse)

### 7.1 Asset Deduplication

When saving a theme, the system scans all `src`/`icon`/`backgroundImage` fields within each widget's `extra`, extracts **Base64 data URLs into standalone files**, and deduplicates them:

```
Before save: theme.json contains data:image/png;base64,... × N times
After save:  assets/{hash}.png (only one copy) + theme.json references the path
```

- Images with identical content are stored only once
- SVGs go into `icons/`; other images go into `assets/`
- File name = content hash + extension, naturally deduplicating

### 7.2 Orphan Asset Cleanup

On save, `cleanup_orphaned_assets` removes old assets no longer referenced by `theme.json`, preventing file bloat.

---

## 8. Theme Packaging and Push Protocol

### 8.1 Packaging (.alc)

1. Read the theme directory + `theme.json`
2. Recursively compress with `zip::ZipWriter`, using the Deflate algorithm
3. Base64-encode, and attach an SHA-256 `hash` checksum

### 8.2 WebSocket Push Protocol (JSON-RPC 2.0)

The PC pushes the `.alc` to the phone over WebSocket in chunks.

**Message methods:**

| Method | params | Description |
|------|--------|------|
| `theme.push.start` | `themeId`, `name`, `version`, `size`, `totalChunks`, `hash` | Push start |
| `theme.push.chunk` | `themeId`, `chunkIndex`, `data` (base64), `isLast` | Push a data chunk |
| `theme.push.complete` | `themeId`, `status` | Push complete |
| `theme.push.cancel` | `themeId`, `reason` | Push cancelled |

**Chunking parameters:**
- Each chunk is **64KB** (`CHUNK_SIZE`)
- Start handshake: wait for the phone to reply `ready`/`busy`/`reject`, with a 10-second timeout; on `busy`, retry every 3 seconds, up to 5 times
- Each chunk: 8-second timeout, up to 3 retries
- Supports resumable transfer (`start_chunk` parameter)

**Phone-side receive flow:**
1. Receive `theme.push.start` → show a confirmation dialog → reply `ready`/`busy`/`reject`
2. Receive 64KB data chunks, acknowledging each one
3. On receiving the last chunk / `complete` → reassemble Base64 → decompress `.alc` → verify SHA-256 → import and render

---

## 9. Theme Management Commands (Tauri)

| Command | Function |
|------|------|
| `scan_themes` | Scan the local theme list |
| `load_theme` | Load detailed theme info |
| `activate_theme` | Activate the currently used theme |
| `get_active_theme` | Get the currently active theme |
| `import_theme` | Import a theme from a file path |
| `import_theme_from_file` | Import from a file (auto-overwrites an existing theme) |
| `delete_theme` | Delete a theme |
| `save_theme` | Save a theme |
| `export_theme` | Export a theme package |
| `pack_theme_data` | Package a theme as Base64 `{base64, size, hash}` |
| `push_theme_to_device` | Push a theme to the phone |
| `download_theme_file` | Download a theme file to local storage (marketplace) |
| `init_themes` | Initialize built-in themes |

---

## 10. Built-in Themes

The system ships with 3 built-in themes, copied to the user directory on first launch:

| Theme ID | Name | Description |
|---------|------|------|
| `perf-dashboard` | Performance Dashboard | System monitoring |
| `control-center` | Control Center | Quick actions |
| `snippet-helper` | Quick Input Helper | Customer service scripts |

---

## 11. Theme Validation Rules

Validated on import / save:

1. `id` is non-empty and cannot contain `/`, `\`, or `..`
2. `name` is non-empty
3. At least 1 page is included
4. Each page `id` is non-empty
5. The layout type must be one of `grid`/`list`/`free`
6. The widget type must be one of the 15 valid types

---

## 12. Runtime Data Push

After a theme is activated, the PC continuously pushes real-time data over WebSocket:

- **System monitoring data**: CPU, memory, disk, network, uptime (every 2 seconds)
- **Media state**: song title, artist, playback status, progress (every 2 seconds)
- Pushed via the `monitor.update` / `media.update` methods, supporting on-demand subscription (`theme.enter`/`theme.leave`)

---

## Conclusion

This document fully describes the Alink Cat theme system's data model, widget specification, editor, resource management, packaging, and push protocol. When the backend builds the theme documentation page, it can present and integrate against the widget property definitions in Chapter 4, the push protocol in Chapter 8, and the data model in Chapter 3.
