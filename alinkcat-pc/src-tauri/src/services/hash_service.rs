use sha2::{Digest, Sha256};
use std::path::Path;

/// sha-256 of a file, lowercase hex
pub fn sha256_file(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("读取文件失败: {}", e))?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let digest = hasher.finalize();
    Ok(format!("{:x}", digest))
}

/// sha-256 of raw bytes
#[allow(dead_code)]
pub fn sha256_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    format!("{:x}", digest)
}

/// total directory size in bytes, recursive
pub fn dir_size(dir: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                total += dir_size(&p);
            } else if let Ok(md) = std::fs::metadata(&p) {
                total += md.len();
            }
        }
    }
    total
}
