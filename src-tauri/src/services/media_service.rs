use serde::{Deserialize, Serialize};

// Used only in the Windows branch (SMTC metadata handling); other platforms would warn about it being unused.
#[cfg(target_os = "windows")]
use regex::Regex;
#[cfg(target_os = "windows")]
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
        println!("[MediaDebug] non-Windows env, no active media session detected, no audio/video source available.");
        Ok(MediaInfo { title: "not playing".into(), artist: String::new(), album: String::new(), is_playing: false, position: 0, duration: 0, thumbnail: None, display_mode: "always".into() })
    }
}

pub async fn execute_media_action(action: &str, volume_level: Option<f64>) -> Result<(), String> {
    #[cfg(target_os = "windows")] { execute_media_action_windows(action, volume_level) }
    #[cfg(not(target_os = "windows"))] { let _ = (action, volume_level); Err("media control not supported on non-Windows".into()) }
}

// ─── Windows SMTC implementation ─────────────────────────────

#[cfg(target_os = "windows")]
use windows::Media::Control::GlobalSystemMediaTransportControlsSession;

/// Enumerate all available SMTC sessions (QQ Music may register a separate session).
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
    // Fallback: the current session.
    if let Ok(s) = manager.GetCurrentSession() {
        let cur_id = session_title(&s).unwrap_or_default();
        if cur_id.is_empty() || !sessions.iter().any(|x| session_title(x).as_deref() == Some(&cur_id)) {
            sessions.push(s);
        }
    }
    sessions
}

/// Extract a session title (used for deduplication).
#[cfg(target_os = "windows")]
fn session_title(s: &GlobalSystemMediaTransportControlsSession) -> Option<String> {
    s.TryGetMediaPropertiesAsync().ok()?.get().ok()?.Title().ok().map(|t| t.to_string())
}

/// Extract a session AppUserModelId (used to identify the source in logs).
#[cfg(target_os = "windows")]
fn session_app_id(s: &GlobalSystemMediaTransportControlsSession) -> String {
    s.SourceAppUserModelId().map(|s| s.to_string()).unwrap_or_default()
}

/// Parse complete MediaInfo from an SMTC session.
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

// ─── Window-title fallback (players such as QQ Music that do not register SMTC) ──

/// Known music player process names (extensible).
#[cfg(target_os = "windows")]
const PLAYER_PROCESS_NAMES: &[&str] = &[
    "QQMusic.exe",
    "cloudmusic.exe",
    "NetEaseMusic.exe",
    "MusicUI.exe",
];

/// Common player window-title suffixes, such as "title - artist - QQ Music".
#[cfg(target_os = "windows")]
fn player_suffix_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\s*-\s*(QQ音乐|QQ Music|网易云音乐|CloudMusic|MusicUI)(playing器)?\s*$")
            .expect("invalid player suffix regex")
    })
}

/// Regex for splitting "title - artist".
#[cfg(target_os = "windows")]
fn title_artist_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^\s*(?P<title>.+?)\s*-\s*(?P<artist>.+?)\s*$").expect("invalid title-artist regex"))
}

/// Parse title/artist from a QQ Music-like window title; status is always playing.
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
    // An idle QQ Music window title is just "QQ音乐", so treat it as not playing.
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

/// Find the main window title of a known player process.
/// Find process IDs with a Toolhelp snapshot, then use EnumWindows to locate a visible window.
#[cfg(target_os = "windows")]
fn find_music_window_title() -> Option<String> {
    use windows::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM};
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    };

    // First locate known player process IDs.
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

    // Enumerate top-level windows and take the first visible one belonging to a player process.
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
                    return BOOL(0); // Stop enumeration.
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

// ─── Main entry: SMTC → window-title fallback → not playing ──

#[cfg(target_os = "windows")]
fn get_media_info_windows() -> Result<MediaInfo, String> {
    // Enumerate SMTC sessions.
    let sessions = get_sessions();
    for session in &sessions {
        if let Some(info) = parse_session(session) {
            if !info.title.is_empty() && info.title != "not playing" {
                let app = session_app_id(session);
                println!(
                    "[MediaDebug] captured! source: SMTC({}), status: {}, artist: {}, title: {}",
                    if app.is_empty() { "unknown session".to_string() } else { app },
                    if info.is_playing { "playing" } else { "paused" },
                    info.artist,
                    info.title
                );
                return Ok(info);
            }
        }
    }
    println!("[MediaDebug] SMTC did not capture a valid media session (total {} sessions), falling back to window-title detection...", sessions.len());

    // Window-title fallback (players such as QQ Music that do not register SMTC).
    if let Some(info) = parse_window_title() {
        println!(
            "[MediaDebug] captured! source: window-title fallback({}), status: playing, artist: {}, title: {}",
            PLAYER_PROCESS_NAMES.join("/"),
            info.artist,
            info.title
        );
        return Ok(info);
    }
    println!("[MediaDebug] window-title fallback failed: no active window title found for {}(QQMusic.exe etc.)", PLAYER_PROCESS_NAMES.join("/"));

    // If neither source is available, treat it as not playing.
    println!("[MediaDebug] no active media session detected, no audio/video source available.");
    Ok(MediaInfo {
        title: "not playing".into(), artist: String::new(), album: String::new(),
        is_playing: false, position: 0, duration: 0, thumbnail: None, display_mode: "always".into(),
    })
}

// ─── Media controls ───────────────────────────────────────

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
            let level = volume_level.unwrap_or(0.5).clamp(0.0, 1.0);
            set_system_volume(level)
        }
        _ => Err(format!("unsupported media action: {}", action)),
    }
}

// ─── Volume control (PowerShell + winmm.dll) ───────────────

#[cfg(target_os = "windows")]
fn set_system_volume(level: f64) -> Result<(), String> {
    let raw = (level * 65535.0) as u32;
    let script = format!(
        "Add-Type -TypeDefinition @\"\n\
using System.Runtime.InteropServices;\n\
public class Audio {{\n\
    [DllImport(\"winmm.dll\")]\n\
    public static extern int waveOutSetVolume(int hwo, int dwVolume);\n\
}}\n\
\"@\n\
[Audio]::waveOutSetVolume(-1, {})",
        raw
    );
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| format!("PowerShell execution failed: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("failed to set volume: {}", stderr));
    }
    println!("[Media] Volume set to {}%", (level * 100.0).round());
    Ok(())
}

// ─── Simulate multimedia keys ─────────────────────────────

#[cfg(target_os = "windows")]
fn simulate_media_key(vk: u16) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP};
    unsafe {
        keybd_event(vk as u8, 0, KEYBD_EVENT_FLAGS(0), 0);
        keybd_event(vk as u8, 0, KEYEVENTF_KEYUP, 0);
    }
    Ok(())
}