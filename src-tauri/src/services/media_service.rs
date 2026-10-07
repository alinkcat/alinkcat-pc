use serde::{Deserialize, Serialize};

use regex::Regex;
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaInfo {
    pub title: String,
    pub artist: String,
    pub album: String,
    #[serde(rename = "isPlaying")]
    pub is_playing: bool,
    pub position: i64,
    pub duration: i64,
    pub thumbnail: Option<String>,
    #[serde(rename = "displayMode")]
    pub display_mode: String,
}

pub async fn get_media_info() -> Result<MediaInfo, String> {
    #[cfg(target_os = "windows")] { get_media_info_windows() }
    #[cfg(not(target_os = "windows"))] {
        println!("[MediaDebug] 非 Windows 环境，未检测到活跃的媒体会话，当前无可用音视频源。");
        Ok(MediaInfo { title: "未在播放".into(), artist: String::new(), album: String::new(), is_playing: false, position: 0, duration: 0, thumbnail: None, display_mode: "always".into() })
    }
}

pub async fn execute_media_action(action: &str, volume_level: Option<f64>) -> Result<(), String> {
    #[cfg(target_os = "windows")] { execute_media_action_windows(action, volume_level) }
    #[cfg(not(target_os = "windows"))] { let _ = (action, volume_level); Err("非 Windows 环境不支持媒体控制".into()) }
}

// ─── Windows SMTC ──────────────────────────────────────────

#[cfg(target_os = "windows")]
use windows::Media::Control::GlobalSystemMediaTransportControlsSession;

/// enumerate all SMTC sessions (QQ Music can register as its own session, not the current one)
#[cfg(target_os = "windows")]
fn get_sessions() -> Vec<GlobalSystemMediaTransportControlsSession> {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;
    let Ok(manager) = (|| -> Result<_, String> {
        let m = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
            .map_err(|e| e.to_string())?
            .get()
            .map_err(|e| e.to_string())?;
        Ok(m)
    })() else { return vec![] };

    let mut sessions = Vec::new();
    if let Ok(view) = manager.GetSessions() {
        if let Ok(size) = view.Size() {
            for i in 0..size {
                if let Ok(s) = view.GetAt(i) {
                    sessions.push(s);
                }
            }
        }
    }
    // fall back to the current session
    if let Ok(s) = manager.GetCurrentSession() {
        let cur_id = session_title(&s).unwrap_or_default();
        if cur_id.is_empty() || !sessions.iter().any(|x| session_title(x).as_deref() == Some(&cur_id)) {
            sessions.push(s);
        }
    }
    sessions
}

/// session title, for dedup
#[cfg(target_os = "windows")]
fn session_title(s: &GlobalSystemMediaTransportControlsSession) -> Option<String> {
    s.TryGetMediaPropertiesAsync().ok()?.get().ok()?.Title().ok().map(|t| t.to_string())
}

/// session AppUserModelId, identifies the source in logs (QQMusic.exe and friends)
#[cfg(target_os = "windows")]
fn session_app_id(s: &GlobalSystemMediaTransportControlsSession) -> String {
    s.SourceAppUserModelId().map(|s| s.to_string()).unwrap_or_default()
}

/// parse a full MediaInfo from a single SMTC session
#[cfg(target_os = "windows")]
fn parse_session(session: &GlobalSystemMediaTransportControlsSession) -> Option<MediaInfo> {
    let props = session.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
    let title = props.Title().unwrap_or_default().to_string();
    let artist = props.Artist().unwrap_or_default().to_string();
    let album = props.AlbumTitle().unwrap_or_default().to_string();
    let playback = session.GetPlaybackInfo().ok()?;
    let is_playing = playback.PlaybackStatus().ok()
        == Some(windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing);
    let timeline = session.GetTimelineProperties().ok();
    let position = timeline.as_ref().and_then(|t| t.Position().ok()).map(|t| t.Duration as i64 / 10000).unwrap_or(0);
    let duration = timeline.as_ref().and_then(|t| t.EndTime().ok()).map(|t| t.Duration as i64 / 10000).unwrap_or(0);
    if title.is_empty() && !is_playing { return None; }
    Some(MediaInfo { title, artist, album, is_playing, position, duration, thumbnail: None, display_mode: "always".into() })
}

// ─── window title fallback (players without SMTC, e.g. QQ Music) ──────────────

/// known music player process names (extend as needed)
#[cfg(target_os = "windows")]
const PLAYER_PROCESS_NAMES: &[&str] = &[
    "QQMusic.exe",
    "cloudmusic.exe",
    "NetEaseMusic.exe",
    "MusicUI.exe",
];

/// common player window title suffix, like "song - artist - QQ音乐"
#[cfg(target_os = "windows")]
fn player_suffix_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\s*-\s*(QQ音乐|QQ Music|网易云音乐|CloudMusic|MusicUI)(播放器)?\s*$")
            .expect("invalid player suffix regex")
    })
}

/// "song - artist" splitter regex
#[cfg(target_os = "windows")]
fn title_artist_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^\s*(?P<title>.+?)\s*-\s*(?P<artist>.+?)\s*$").expect("invalid title-artist regex"))
}

/// parse title/artist out of player window titles (QQ Music etc); always reports playing
#[cfg(target_os = "windows")]
fn parse_window_title() -> Option<MediaInfo> {
    let raw = find_music_window_title()?;
    let clean = player_suffix_regex().replace(&raw, "").trim().to_string();
    if clean.is_empty() {
        return None;
    }
    let (title, artist) = match title_artist_regex().captures(&clean) {
        Some(c) => (c["title"].trim().to_string(), c["artist"].trim().to_string()),
        None => (clean, String::new()),
    };
    // idle QQ Music window title is just "QQ音乐", treat as not playing
    if title.is_empty()
        || title.eq_ignore_ascii_case("QQ音乐")
        || title.eq_ignore_ascii_case("QQ Music")
        || title.eq_ignore_ascii_case("网易云音乐")
    {
        return None;
    }
    Some(MediaInfo {
        title, artist, album: String::new(), is_playing: true,
        position: 0, duration: 0, thumbnail: None, display_mode: "always".into(),
    })
}

/// find the main window title of known player processes:
/// Toolhelp snapshot to get PIDs, then EnumWindows for a visible window owned by one
#[cfg(target_os = "windows")]
fn find_music_window_title() -> Option<String> {
    use windows::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM};
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    };

    let mut pids: Vec<u32> = Vec::new();
    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else { return None };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        let mut found = Process32FirstW(snapshot, &mut entry).is_ok();
        while found {
            let name = String::from_utf16_lossy(&entry.szExeFile);
            if PLAYER_PROCESS_NAMES.iter().any(|p| name.eq_ignore_ascii_case(p)) {
                pids.push(entry.th32ProcessID);
            }
            found = Process32NextW(snapshot, &mut entry).is_ok();
        }
        let _ = CloseHandle(snapshot);
    }
    if pids.is_empty() {
        return None;
    }

    struct WindowCtx {
        pids: Vec<u32>,
        title: Option<String>,
    }
    unsafe extern "system" fn enum_window_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = lparam.0 as *mut WindowCtx;
        let ctx = &mut *ctx;
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if ctx.pids.contains(&pid) && IsWindowVisible(hwnd).as_bool() {
            let mut buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut buf);
            if len > 0 {
                let title = String::from_utf16_lossy(&buf[..len as usize]).trim().to_string();
                if !title.is_empty() {
                    ctx.title = Some(title);
                    return BOOL(0); // stop enumerating
                }
            }
        }
        BOOL(1)
    }

    let mut ctx = WindowCtx { pids, title: None };
    let ctx_ptr = &mut ctx as *mut WindowCtx;
    unsafe {
        let _ = EnumWindows(Some(enum_window_proc), LPARAM(ctx_ptr as isize));
    }
    ctx.title
}

// ─── main entry: SMTC -> window title fallback -> not playing ──────────────

#[cfg(target_os = "windows")]
fn get_media_info_windows() -> Result<MediaInfo, String> {
    let sessions = get_sessions();
    for session in &sessions {
        if let Some(info) = parse_session(session) {
            if !info.title.is_empty() && info.title != "未在播放" {
                let app = session_app_id(session);
                println!(
                    "[MediaDebug] 成功抓取！来源: SMTC({}), 状态: {}, 歌手: {}, 歌名: {}",
                    if app.is_empty() { "未知会话".to_string() } else { app },
                    if info.is_playing { "播放" } else { "暂停" },
                    info.artist,
                    info.title
                );
                return Ok(info);
            }
        }
    }
    println!("[MediaDebug] SMTC 未捕获到有效媒体会话（共 {} 个会话），尝试窗口标题兜底…", sessions.len());

    // window title fallback (players that don't register SMTC)
    if let Some(info) = parse_window_title() {
        println!(
            "[MediaDebug] 成功抓取！来源: 窗口标题兜底({}), 状态: 播放, 歌手: {}, 歌名: {}",
            PLAYER_PROCESS_NAMES.join("/"),
            info.artist,
            info.title
        );
        return Ok(info);
    }
    println!("[MediaDebug] 窗口标题兜底失败：未找到 {}(QQMusic.exe 等) 的活动窗口标题", PLAYER_PROCESS_NAMES.join("/"));

    // nothing anywhere -> report as not playing
    println!("[MediaDebug] 未检测到活跃的媒体会话，当前无可用音视频源。");
    Ok(MediaInfo {
        title: "未在播放".into(), artist: String::new(), album: String::new(),
        is_playing: false, position: 0, duration: 0, thumbnail: None, display_mode: "always".into(),
    })
}

// ─── media control ─────────────────────────────────────────

#[cfg(target_os = "windows")]
fn execute_media_action_windows(action: &str, volume_level: Option<f64>) -> Result<(), String> {
    let sessions = get_sessions();
    let session = sessions.first();

    match action {
        "play" | "pause" | "play_pause" | "next" | "previous" => {
            if let Some(s) = session {
                match action {
                    "play" => { s.TryPlayAsync().map_err(|e| e.to_string())?.get().map_err(|e| e.to_string())?; }
                    "pause" => { s.TryPauseAsync().map_err(|e| e.to_string())?.get().map_err(|e| e.to_string())?; }
                    "play_pause" => {
                        let info = get_media_info_windows()?;
                        if info.is_playing {
                            s.TryPauseAsync().map_err(|e| e.to_string())?.get().map_err(|e| e.to_string())?;
                        } else {
                            s.TryPlayAsync().map_err(|e| e.to_string())?.get().map_err(|e| e.to_string())?;
                        }
                    }
                    "next" => { s.TrySkipNextAsync().map_err(|e| e.to_string())?.get().map_err(|e| e.to_string())?; }
                    "previous" => { s.TrySkipPreviousAsync().map_err(|e| e.to_string())?.get().map_err(|e| e.to_string())?; }
                    _ => {}
                }
            }
            Ok(())
        }
        "volume_up" => simulate_media_key(0xAF),
        "volume_down" => simulate_media_key(0xAE),
        "volume_mute" => simulate_media_key(0xAD),
        "volume_set" => {
            // phone sends 0-100, older callers may send 0-1 — accept both scales
            let raw = volume_level.unwrap_or(50.0);
            let level = (if raw > 1.0 { raw / 100.0 } else { raw }).clamp(0.0, 1.0);
            set_system_volume(level)
        }
        _ => Err(format!("不支持的媒体操作: {}", action)),
    }
}

// ─── volume control (Core Audio master endpoint) ─────────────────
// NOTE: the legacy waveOutSetVolume only touches the calling process's
// audio session on Vista+ — the system volume everyone hears lives on
// the default render endpoint, so go through IAudioEndpointVolume.

#[cfg(target_os = "windows")]
fn set_system_volume(level: f64) -> Result<(), String> {
    use windows::Win32::Media::Audio::{eMultimedia, eRender, Endpoints::IAudioEndpointVolume, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};

    unsafe {
        // the handler thread may already have COM in another apartment; both work here
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: windows::Win32::Media::Audio::IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                .map_err(|e| format!("audio enumerator: {e}"))?;
        let device = enumerator
            .GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|e| format!("default audio device: {e}"))?;
        let endpoint: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("audio endpoint: {e}"))?;
        endpoint
            .SetMasterVolumeLevelScalar(level as f32, std::ptr::null())
            .map_err(|e| format!("set volume: {e}"))?;
        let readback: f32 = endpoint.GetMasterVolumeLevelScalar().unwrap_or(-1.0);
        println!("[Media] volume wrote {:.2}, endpoint readback {:.2}", level, readback);
    }
    println!("[Media] Volume set to {}%", (level * 100.0).round());
    Ok(())
}

// ─── simulated media keys ──────────────────────────────────

#[cfg(target_os = "windows")]
fn simulate_media_key(vk: u16) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP};
    unsafe {
        keybd_event(vk as u8, 0, KEYBD_EVENT_FLAGS(0), 0);
        keybd_event(vk as u8, 0, KEYEVENTF_KEYUP, 0);
    }
    Ok(())
}