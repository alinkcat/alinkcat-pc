use std::process::Command as StdCommand;

use chrono::Local;

use super::keyboard;
use super::types::*;
use crate::theme::config;

const INJECTION_CHARS: &[char] = &['&', '|', ';', '`', '$', '(', ')', '{', '}', '\n', '\r'];

fn log_action(action_type: &str, detail: &str, success: bool) {
    let ts = Local::now().format("%Y-%m-%d %H:%M:%S");
    let status = if success { "OK" } else { "FAIL" };
    println!("[{}] [Action] {} {} => {}", ts, action_type, detail, status);
}

fn check_injection(s: &str) -> Result<(), String> {
    for ch in s.chars() {
        if INJECTION_CHARS.contains(&ch) {
            return Err(format!(
                "Blocked: forbidden character '{}' in '{}'",
                ch, s
            ));
        }
    }
    Ok(())
}

fn check_command_whitelist(cmd: &str) -> Result<(), String> {
    let cfg = config::load_config();
    if cfg.command_whitelist.is_empty() {
        return Ok(());
    }
    let basename = cmd
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(cmd)
        .trim_end_matches(".exe")
        .to_lowercase();
    if cfg
        .command_whitelist
        .iter()
        .any(|w| w.trim_end_matches(".exe").to_lowercase() == basename)
    {
        Ok(())
    } else {
        Err(format!("Command '{}' is not in the whitelist", cmd))
    }
}

// ─── Platform-specific open ─────────────────────────────────

#[cfg(target_os = "windows")]
fn open_path(path: &str, args: &[String]) -> Result<(), String> {
    let mut cmd = StdCommand::new("cmd");
    cmd.args(["/C", "start", "", path]);
    if !args.is_empty() {
        cmd.args(args);
    }
    cmd.spawn()
        .map_err(|e| format!("Failed to open '{}': {}", path, e))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_path(path: &str, args: &[String]) -> Result<(), String> {
    let mut cmd = StdCommand::new("open");
    cmd.arg(path);
    if !args.is_empty() {
        cmd.arg("--args");
        cmd.args(args);
    }
    cmd.spawn()
        .map_err(|e| format!("Failed to open '{}': {}", path, e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn open_path(path: &str, args: &[String]) -> Result<(), String> {
    let mut cmd = StdCommand::new("xdg-open");
    cmd.arg(path);
    if !args.is_empty() {
        cmd.args(args);
    }
    cmd.spawn()
        .map_err(|e| format!("Failed to open '{}': {}", path, e))?;
    Ok(())
}

// ─── URL validation ─────────────────────────────────────────

fn validate_url(url: &str) -> Result<(), String> {
    if url.starts_with("http://") || url.starts_with("https://") {
        Ok(())
    } else {
        Err("URL must start with http:// or https://".into())
    }
}

// ─── Core executor ──────────────────────────────────────────

pub fn execute(action: &ActionDefinition) -> Result<ActionResult, String> {
    match action {
        ActionDefinition::Keyboard { keys, modifiers } => {
            let detail = format!(
                "keys=[{}], mods=[{}]",
                keys.join(","),
                modifiers.join(",")
            );
            match keyboard::execute_keyboard(keys, modifiers) {
                Ok(()) => {
                    log_action("keyboard", &detail, true);
                    Ok(ActionResult::ok("keyboard", &format!("Pressed: {}", detail)))
                }
                Err(e) => {
                    log_action("keyboard", &detail, false);
                    Err(e)
                }
            }
        }

        ActionDefinition::Open { path, args } => {
            check_injection(path)?;
            for a in args {
                check_injection(a)?;
            }
            let detail = format!("{} {}", path, args.join(" "));
            match open_path(path, args) {
                Ok(()) => {
                    log_action("open", &detail, true);
                    Ok(ActionResult::ok("open", &format!("Opened: {}", path)))
                }
                Err(e) => {
                    log_action("open", &detail, false);
                    Err(e)
                }
            }
        }

        ActionDefinition::Url { url } => {
            validate_url(url)?;
            let detail = url.clone();
            match open_path(url, &[]) {
                Ok(()) => {
                    log_action("url", &detail, true);
                    Ok(ActionResult::ok("url", &format!("Opened URL: {}", url)))
                }
                Err(e) => {
                    log_action("url", &detail, false);
                    Err(e)
                }
            }
        }

        ActionDefinition::Snippet { content } => {
            let preview = if content.len() > 40 {
                format!("{}...", &content[..40])
            } else {
                content.clone()
            };
            match keyboard::execute_snippet(content) {
                Ok(()) => {
                    log_action("snippet", &preview, true);
                    Ok(ActionResult::ok(
                        "snippet",
                        &format!("Typed {} chars", content.len()),
                    ))
                }
                Err(e) => {
                    log_action("snippet", &preview, false);
                    Err(e)
                }
            }
        }

        ActionDefinition::Command { command, args } => {
            check_injection(command)?;
            for a in args {
                check_injection(a)?;
            }
            check_command_whitelist(command)?;

            let detail = format!("{} {}", command, args.join(" "));

            let output = StdCommand::new(command)
                .args(args)
                .output()
                .map_err(|e| {
                    log_action("command", &detail, false);
                    format!("Failed to execute '{}': {}", command, e)
                })?;

            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let success = output.status.success();

            log_action("command", &detail, success);

            let mut result = if success {
                ActionResult::ok("command", &format!("Exit code: {}", output.status))
            } else {
                ActionResult::fail(
                    "command",
                    &format!("Exit code: {}", output.status.code().unwrap_or(-1)),
                )
            };

            if !stdout.is_empty() {
                result = result.with_stdout(stdout);
            }
            if !stderr.is_empty() {
                result = result.with_stderr(stderr);
            }

            Ok(result)
        }

        ActionDefinition::Multi {
            actions,
            stop_on_error,
        } => {
            let mut children = Vec::new();
            let mut all_ok = true;

            for sub in actions {
                match execute(sub) {
                    Ok(r) => {
                        if !r.success {
                            all_ok = false;
                        }
                        children.push(r);
                    }
                    Err(e) => {
                        all_ok = false;
                        children.push(ActionResult::fail("multi-child", &e));
                        if *stop_on_error {
                            break;
                        }
                    }
                }
            }

            let msg = if all_ok {
                format!("{} actions OK", children.len())
            } else {
                format!("{}/{} actions failed", children.iter().filter(|r| !r.success).count(), children.len())
            };

            let mut result = if all_ok {
                ActionResult::ok("multi", &msg)
            } else {
                ActionResult::fail("multi", &msg)
            };
            result = result.with_children(children);
            log_action("multi", &msg, all_ok);
            Ok(result)
        }
    }
}
