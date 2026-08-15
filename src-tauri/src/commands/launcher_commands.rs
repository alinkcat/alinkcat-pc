use crate::services::launcher_service;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct LauncherResolveResult {
    pub name: String,
    pub resolved_path: String,
}

#[tauri::command]
pub fn get_launchers() -> Vec<launcher_service::LauncherItem> {
    launcher_service::list()
}

#[tauri::command]
pub fn add_launcher(name: String, path: String) -> Result<launcher_service::LauncherItem, String> {
    launcher_service::add(name, path)
}

#[tauri::command]
pub fn remove_launcher(id: String) -> Result<(), String> {
    launcher_service::remove(&id)
}

#[tauri::command]
pub fn open_launcher(id: String) -> Result<(), String> {
    launcher_service::open(&id)
}

/// 使用 PowerShell 提取 .exe/.lnk 的图标，返回 data:image/png;base64,...
#[tauri::command]
pub fn extract_app_icon(path: String) -> Result<String, String> {
    let resolved = resolve_real_path(&path)?;
    let script = format!(
        r#"Add-Type -AssemblyName System.Drawing; try {{ $i=[System.Drawing.Icon]::ExtractAssociatedIcon('{}'); if($i){{ $b=New-Object System.IO.MemoryStream; $i.ToBitmap().Save($b,[System.Drawing.Imaging.ImageFormat]::Png); $d=[Convert]::ToBase64String($b.ToArray()); $b.Close(); Write-Output $d }} }} catch {{ }} exit 0"#,
        resolved.replace('\'', "''")
    );
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| format!("PowerShell 执行失败: {}", e))?;
    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if result.is_empty() {
        // 部分 exe 可能没有图标，返回默认占位空字符串
        return Ok(String::new());
    }
    Ok(format!("data:image/png;base64,{}", result))
}

fn resolve_real_path(path: &str) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if ext == "lnk" { resolve_lnk(path) } else { Ok(path.to_string()) }
}
#[tauri::command]
pub fn resolve_launcher_path(path: String) -> Result<LauncherResolveResult, String> {
    let p = std::path::Path::new(&path);
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

    // 解析 .lnk 快捷方式 → 获取真实目标路径
    let resolved = if ext == "lnk" {
        resolve_lnk(&path)?
    } else {
        path.clone()
    };

    // 提取显示名称（无扩展名文件名）
    let name = std::path::Path::new(&resolved)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("应用")
        .to_string();

    Ok(LauncherResolveResult { name, resolved_path: resolved })
}

/// 使用 PowerShell 解析 .lnk 快捷方式的目标路径（跨 Win7+ 兼容）
fn resolve_lnk(path: &str) -> Result<String, String> {
    let escaped = path.replace('\'', "''");
    let script = format!(
        "(New-Object -ComObject WScript.Shell).CreateShortcut('{}').TargetPath",
        escaped
    );
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output()
        .map_err(|e| format!("PowerShell 执行失败: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("快捷方式解析失败: {}", stderr));
    }
    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if result.is_empty() {
        return Err("无法解析快捷方式目标".to_string());
    }
    Ok(result)
}