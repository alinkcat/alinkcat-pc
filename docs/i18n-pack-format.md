# Language Pack Format

Alinkcat PC ships English-only. Additional languages are provided as community language packs that users import via **Settings → Language → Import**.

## Pack File

A single JSON file with this shape:

```json
{
  "code": "zh-CN",
  "label": "简体中文",
  "resources": {
    "common": { ... },
    "auth": { ... },
    ...
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | BCP 47 language tag, e.g. `zh-CN`, `ja-JP`, `ko-KR` |
| `label` | string | Language name in its own script, e.g. `简体中文`, `日本語` |
| `resources` | object | Map of namespace → key/value pairs (see below) |

A flat format is also accepted — top-level keys that are not `code` or `label` are treated as namespaces:

```json
{
  "code": "zh-CN",
  "label": "简体中文",
  "common": { ... },
  "auth": { ... }
}
```

## Namespaces

All 21 namespaces must be present for full coverage. Missing namespaces fall back to English.

| Namespace | Keys | Covers |
|-----------|------|--------|
| `common` | ~43 | shared buttons, labels, generic text |
| `auth` | ~66 | login, register, OAuth, password |
| `cloud` | ~26 | cloud service submenu |
| `devices` | ~51 | device management, status |
| `editor` | ~9 | theme editor labels |
| `layout` | ~3 | header, sidebar, footer |
| `market` | ~45 | theme marketplace |
| `member` | ~76 | membership, subscription, billing |
| `notifications` | ~21 | notification center |
| `onboarding` | ~8 | first-run guide |
| `points` | ~56 | points system, rewards |
| `profile` | ~69 | user profile, settings |
| `push` | ~2 | theme push to device |
| `settings` | ~68 | app settings |
| `snippets` | ~33 | code snippets, AI prompts |
| `terms` | ~13 | legal text |
| `themes` | ~69 | theme management, version history |
| `tickets` | ~45 | support tickets |
| `upload` | ~62 | theme upload, file management |
| `invite` | ~27 | invitation system |
| `admin` | ~6 | admin panel |

## Reference Implementation

The `community-locales/zh-CN/` directory contains a complete Simplified Chinese pack as a working reference. Each `.json` file maps one-to-one to a namespace.

## Creating a Pack

1. Copy `community-locales/zh-CN/` as a starting point
2. Translate the values (right-hand side of each key) to your language
3. Combine all namespace files into a single JSON with the `code`, `label`, and `resources` structure
4. Import via Settings → Language → Import

## Persistence

Imported packs are stored in `localStorage` and survive app restarts. The pack is scoped to the current device — it is not synced across machines.

## antd Locale

The app uses `antd` (Ant Design) for UI components. antd's own locale is set to `en_US` for imported packs. If your language has a matching antd locale (e.g. `ja_JP`, `ko_KR`, `de_DE`), it will be used automatically for built-in languages. For imported packs, antd falls back to English component text.
