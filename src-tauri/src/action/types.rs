use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ActionDefinition {
    #[serde(rename = "keyboard")]
    Keyboard {
        keys: Vec<String>,
        #[serde(default)]
        modifiers: Vec<String>,
    },
    #[serde(rename = "open")]
    Open {
        path: String,
        #[serde(default)]
        args: Vec<String>,
    },
    #[serde(rename = "url")]
    Url { url: String },
    #[serde(rename = "snippet")]
    Snippet { content: String },
    #[serde(rename = "command")]
    Command {
        command: String,
        #[serde(default)]
        args: Vec<String>,
    },
    #[serde(rename = "multi")]
    Multi {
        actions: Vec<ActionDefinition>,
        #[serde(default = "default_true", rename = "stopOnError")]
        stop_on_error: bool,
    },
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionResult {
    pub success: bool,
    #[serde(rename = "actionType")]
    pub action_type: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stdout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stderr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<ActionResult>>,
}

impl ActionResult {
    pub fn ok(action_type: &str, message: &str) -> Self {
        Self {
            success: true,
            action_type: action_type.into(),
            message: message.into(),
            stdout: None,
            stderr: None,
            children: None,
        }
    }

    pub fn fail(action_type: &str, message: &str) -> Self {
        Self {
            success: false,
            action_type: action_type.into(),
            message: message.into(),
            stdout: None,
            stderr: None,
            children: None,
        }
    }

    pub fn with_stdout(mut self, s: String) -> Self {
        self.stdout = Some(s);
        self
    }

    pub fn with_stderr(mut self, s: String) -> Self {
        self.stderr = Some(s);
        self
    }

    pub fn with_children(mut self, c: Vec<ActionResult>) -> Self {
        self.children = Some(c);
        self
    }
}
