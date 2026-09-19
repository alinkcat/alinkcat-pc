use enigo::{Direction, Enigo, Key, Keyboard, Settings};

/// Write text to the system clipboard, then simulate Ctrl+V / Cmd+V at the current cursor position.
pub fn inject_snippet(text: &str) -> Result<(), String> {
    clipboard_write(text)?;
    simulate_paste()
}

fn clipboard_write(text: &str) -> Result<(), String> {
    // Use arboard to write to the system clipboard
    let mut ctx = arboard::Clipboard::new().map_err(|e| format!("failed to initialize clipboard: {}", e))?;
    ctx.set_text(text).map_err(|e| format!("failed to write to clipboard: {}", e))?;
    Ok(())
}

fn simulate_paste() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("failed to initialize keyboard simulation: {}", e))?;

    #[cfg(target_os = "macos")]
    let mod_key = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let mod_key = Key::Control;

    enigo.key(mod_key, Direction::Press)
        .map_err(|e| format!("key down failed: {}", e))?;
    enigo.key(Key::Unicode('v'), Direction::Click)
        .map_err(|e| format!("key click failed: {}", e))?;
    enigo.key(mod_key, Direction::Release)
        .map_err(|e| format!("key up failed: {}", e))?;

    Ok(())
}