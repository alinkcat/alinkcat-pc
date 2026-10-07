use enigo::{Direction, Enigo, Key, Keyboard, Settings};

/// write text to the clipboard, then simulate Ctrl+V / Cmd+V at the cursor
pub fn inject_snippet(text: &str) -> Result<(), String> {
    clipboard_write(text)?;
    simulate_paste()
}

fn clipboard_write(text: &str) -> Result<(), String> {
    let mut ctx = arboard::Clipboard::new().map_err(|e| format!("剪贴板初始化失败: {}", e))?;
    ctx.set_text(text).map_err(|e| format!("剪贴板写入失败: {}", e))?;
    Ok(())
}

fn simulate_paste() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("键盘模拟初始化失败: {}", e))?;

    #[cfg(target_os = "macos")]
    let mod_key = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let mod_key = Key::Control;

    enigo.key(mod_key, Direction::Press)
        .map_err(|e| format!("按键按下失败: {}", e))?;
    enigo.key(Key::Unicode('v'), Direction::Click)
        .map_err(|e| format!("按键点击失败: {}", e))?;
    enigo.key(mod_key, Direction::Release)
        .map_err(|e| format!("按键释放失败: {}", e))?;

    Ok(())
}