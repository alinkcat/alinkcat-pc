# ailinkcat — PC Client

> Theme designer · Hardware monitoring · Multi-device sync toolkit

ailinkcat is a PC-to-Android productivity suite: **the PC client creates, manages, and pushes theme packages**; the Android client receives, renders, and interacts with them. This repository is the PC client (a Tauri 2 desktop app).

System monitoring dashboards, quick-control centers, media players, or custom desktop layouts — drag them together in the editor, then push them to your phone in real time over the local network.

---

## ✨ Features

### 🎨 Theme Editor

- **15 widget types**: button, gauge, snippet list, image, text, shape, webview, media control, system monitor, quick-action grid, app launcher, clock, date, calendar, icon
- **Three layout modes**: Grid, List, Free
- **AI-assisted design**: drive the editor with natural language (8 instruction types), drop in images for auto-recognition
- **Asset deduplication**: base64 images auto-extracted to files; cross-page reuse stores only one copy
- **Export**: package as `.alc` for one-click sharing
- **File manager**: tree-view browser for theme assets
- Orientation toggle, live preview, multi-level undo

### 📡 Multi-Device Sync

- **WebSocket real-time push**: PC-edited themes pushed to Android (chunked transfer + SHA-256 verification + resume)
- **Hardware monitoring**: CPU / memory / disk / network usage synced live
- **Media control**: QQ Music and other player status sync and control
- **Quick actions**: app launching, quick-panel command dispatch

### 🛒 Theme Marketplace

- Browse, download, and rate themes shared by other users
- Upload your own work; submit for review to publish
- Favorites management, version history

### 👤 User System

- Account registration / login (email verification code anti-abuse)
- GitHub OAuth one-click login
- Points center (daily check-in, redemption shop, leaderboards)
- Membership tiers (Advanced / Pro, comparison below)
- Ticket system (issue reporting and replies)
- Invite friends (both sides earn points)

### ☁️ Cloud Services

- **Theme cloud backup**: upload / restore / delete, retrieve anytime
- **Weather service**: apply for a weather API key (ALM- format) in one click, drop it into the Android client — no need to register with a third-party weather API
- **Notification center**: review, system, and points notifications
- **Profile**: change password, link GitHub

### 🔧 System

- Automatic version checks (startup + periodic polling), supports forced updates
- Global error boundary, crash auto-recovery
- Token expiry forces re-login
- Encrypted diagnostic log export
- Dark / light theme toggle
- Built-in Terms of Service page

---

## 💻 Installation

### System Requirements

| Platform | Requirement |
|----------|-------------|
| Windows | Windows 10 1809+ / Windows 11 |
| macOS | macOS 10.15+ |
| Memory | ≥ 4 GB |
| Disk | ≥ 500 MB |

### Download

Head to [GitHub Releases](https://github.com/alinkcat/alinkcat-pc/releases) and grab the installer for your platform:

| Platform | File |
|----------|------|
| Windows | `.exe` or `.msi` |
| macOS | `.dmg` (Apple Silicon / Intel) |

> If Windows SmartScreen appears on first run, click "More info → Run anyway".

### Build from Source

```bash
# Prerequisites: Node.js 20+, pnpm 9+, Rust stable
# macOS: Xcode Command Line Tools (xcode-select --install)
# Windows: WebView2 (usually included with Win10/11) + Microsoft C++ Build Tools
pnpm install
pnpm tauri dev     # development
pnpm tauri build   # production build
```

> The repo enforces LF line endings via `.gitattributes`, so cross-platform cloning won't produce CRLF warnings or line-ending drift.

---

## 🚀 Quick Start

1. **Install and launch** — the first run shows an onboarding guide.
2. **Register an account** (see Cloud Services below), or explore local features as a guest.
3. **Create a theme**: open the Editor → drag in widgets → adjust styles → save.
4. **Push to phone**: install the ailinkcat app on Android, join the same LAN, scan to connect, then push the theme.
5. **Cloud backup**: log in, go to "My Cloud", and upload themes so you can restore them on a new device.

---

## ☁️ Cloud Services Guide

### Register

The in-app Login / Register page offers two options:

- **Email**: enter a username (3–50 chars), password (≥6), and email; get a verification code and submit (phone/nickname optional).
- **GitHub**: one-click authorize; account created automatically.

You must agree to the in-app Terms of Service during registration.

### Login

- Username + password
- GitHub one-click login
- On token expiry, a re-login modal appears — sessions are never silently dropped.

### Membership

The Membership page shows your current tier, lets you purchase or redeem membership, and apply for a weather key. Benefits are split across Free / Advanced / Pro tiers (see the in-app comparison for exact numbers):

| Benefit | Free | Advanced | Pro |
|---------|:---:|:---:|:---:|
| Cloud storage | base quota | larger | larger |
| File / count limit | base | higher | higher |
| AI chats (/month) | — | limited | more |
| Ad-free | — | ✅ | ✅ |
| Fast download | — | ✅ | ✅ |
| Custom themes | — | ✅ | ✅ |
| Data export / priority support / multi-device sync | — | ✅ | ✅ |

Ways to get membership:

- **Direct purchase**: generate an order and pay.
- **Points redemption**: check in, complete tasks, and redeem points for membership time.
- **Card key**: enter a card key (e.g. `ALCX7K2M9F4R1Q3`) for instant activation.

### Weather API Key

The PC client saves you from registering with a third-party weather service:

1. Go to "Membership → Weather Service".
2. Click **Apply for Key** to get an `ALM-` prefixed key (**shown only once — copy it immediately**).
3. Paste the key into the Android weather widget — no login needed.
4. If lost, **Reset** in the membership center (the old key is invalidated instantly).

> The daily quota is locked to your membership tier at the time of application to prevent abuse.

### Theme Cloud Backup

The "My Cloud" page lets you upload local themes (auto-packaged as `.alc`), check cloud storage usage, download/restore, and delete. Storage is tier-dependent.

### Tickets & Notifications

Hit a snag? Submit a ticket in the "Ticket Center" (attach a diagnostic log for faster resolution). Review results, system announcements, and points changes show up in the "Notification Center".

---

## 🧱 Tech Stack & Directory

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite 7 + Ant Design 6 + zustand + i18next |
| Desktop shell | Tauri 2 (Rust) |
| Local services | Rust-side WebSocket server (port 9527) + hardware monitoring / media control / weather / RSS / Bilibili APIs |
| Communication protocol | JSON-RPC 2.0 over WebSocket (interoperable with the Android client) |
| Cloud backend | Independent Spring Boot service (**not open source**; see statement below) |

```
├── src/               # React frontend
│   ├── api/           # Cloud API client
│   ├── components/    # Shared components
│   ├── hooks/         # Push, AI, WebSocket, and other hooks
│   ├── i18n/          # Internationalization (en-US built-in; importable language packs)
│   ├── pages/         # Pages (editor / market / membership / cloud drive / settings…)
│   ├── store/         # zustand state
│   ├── templates/     # Built-in theme templates
│   └── utils/         # Utilities
├── src-tauri/         # Rust backend
│   └── src/
│       ├── action/    # Quick-action executors (keyboard simulation / app launching)
│       ├── commands/  # Tauri commands
│       ├── monitor/   # Hardware metric collection (CPU / memory / disk / network)
│       ├── services/  # Weather / media / launcher / RSS / OAuth, etc.
│       ├── websocket/ # LAN push service
│       └── theme/     # Theme package reading, writing, and packaging
├── community-locales/ # Community language pack reference (zh-CN)
├── docs/              # Documentation
└── public/            # Static assets
```

---

## 🌐 Language Packs

The app ships English-only. Additional languages are provided as community language packs:

1. Copy the reference pack from `community-locales/zh-CN/`
2. Translate the JSON values
3. Import via **Settings → Language → Import**

See [docs/i18n-pack-format.md](docs/i18n-pack-format.md) for the full format specification.

---

## ⚠️ Open Source & Cloud Service Notice

**This repository open-sources only the PC client code (frontend + Tauri local services).**

1. The cloud backend (Spring Boot) is a separate private repository and is **not** open-sourced here.
2. You may **not** reverse-engineer, crack, reimplement, or set up a "pirated cloud" — including but not limited to reusing/modifying the official API protocol, impersonating the official service, or redirecting the client to an unofficial backend.
3. Cloud-service features (registration, membership, cloud backup, marketplace, weather key, etc.) may **only** connect to the official cloud service (https://www.pynen.com).
4. Violations may result in account bans, data loss, and legal liability — solely borne by the violator.

Please respect the developers' work and help maintain a healthy open-source ecosystem.

---

## 🤝 Feedback

- Submit issues and suggestions via the in-app "Ticket Center".
- Bug reports and feature requests are welcome at [GitHub Issues](https://github.com/alinkcat/alinkcat-pc/issues).

---

## 📄 License

> License pending — a LICENSE file will be added once decided.

---

> ailinkcat
> Website: https://www.pynen.com
> PC repo: https://github.com/alinkcat/alinkcat-pc
> Android: not open source at this time
