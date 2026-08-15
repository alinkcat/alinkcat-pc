use enigo::{Direction, Enigo, Key, Keyboard, Settings};

fn parse_key(name: &str) -> Option<Key> {
    let lower = name.to_lowercase();
    match lower.as_str() {
        "ctrl" | "control" => Some(Key::Control),
        "alt" | "option" => Some(Key::Alt),
        "shift" => Some(Key::Shift),
        "meta" | "super" | "win" | "command" => Some(Key::Meta),
        "enter" | "return" => Some(Key::Return),
        "tab" => Some(Key::Tab),
        "escape" | "esc" => Some(Key::Escape),
        "space" => Some(Key::Space),
        "backspace" => Some(Key::Backspace),
        "delete" | "del" => Some(Key::Delete),
        "up" => Some(Key::UpArrow),
        "down" => Some(Key::DownArrow),
        "left" => Some(Key::LeftArrow),
        "right" => Some(Key::RightArrow),
        "home" => Some(Key::Home),
        "end" => Some(Key::End),
        "pageup" => Some(Key::PageUp),
        "pagedown" => Some(Key::PageDown),
        "capslock" => Some(Key::CapsLock),
        "insert" => Some(Key::Insert),
        "f1" => Some(Key::F1),
        "f2" => Some(Key::F2),
        "f3" => Some(Key::F3),
        "f4" => Some(Key::F4),
        "f5" => Some(Key::F5),
        "f6" => Some(Key::F6),
        "f7" => Some(Key::F7),
        "f8" => Some(Key::F8),
        "f9" => Some(Key::F9),
        "f10" => Some(Key::F10),
        "f11" => Some(Key::F11),
        "f12" => Some(Key::F12),
        _ => {
            if lower.len() == 1 {
                lower.chars().next().map(Key::Unicode)
            } else {
                None
            }
        }
    }
}

pub fn execute_keyboard(keys: &[String], modifiers: &[String]) -> Result<(), String> {
    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|e| format!("Failed to init keyboard: {}", e))?;

    let mod_keys: Vec<Key> = modifiers
        .iter()
        .map(|m| parse_key(m).ok_or_else(|| format!("Unknown modifier: {}", m)))
        .collect::<Result<Vec<_>, _>>()?;

    let action_keys: Vec<Key> = keys
        .iter()
        .map(|k| parse_key(k).ok_or_else(|| format!("Unknown key: {}", k)))
        .collect::<Result<Vec<_>, _>>()?;

    for mk in &mod_keys {
        enigo
            .key(*mk, Direction::Press)
            .map_err(|e| format!("Press modifier error: {}", e))?;
    }

    for ak in &action_keys {
        enigo
            .key(*ak, Direction::Click)
            .map_err(|e| format!("Key click error: {}", e))?;
    }

    for mk in mod_keys.iter().rev() {
        enigo
            .key(*mk, Direction::Release)
            .map_err(|e| format!("Release modifier error: {}", e))?;
    }

    Ok(())
}

pub fn execute_snippet(content: &str) -> Result<(), String> {
    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|e| format!("Failed to init keyboard: {}", e))?;

    enigo
        .text(content)
        .map_err(|e| format!("Text input error: {}", e))?;

    Ok(())
}
