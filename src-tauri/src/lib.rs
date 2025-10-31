mod har;

use har::{HarFile, HarRequest, AlignedPair, ComparisonResult, DetailedComparison, WhitelistConfig, parse_har_file, compare_requests, compare_requests_with_whitelist, align_requests_with_whitelist, align_requests_like_vscode_with_whitelist, create_detailed_comparison_with_whitelist, parse_whitelist_config};
use std::fs;
use std::collections::HashMap;
use std::sync::{Mutex, LazyLock};

// Global storage for comparison data
static COMPARISON_DATA_STORE: LazyLock<Mutex<HashMap<String, String>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

// Global storage for whitelist config
static WHITELIST_CONFIG: LazyLock<Mutex<WhitelistConfig>> = LazyLock::new(|| Mutex::new(WhitelistConfig::new()));

#[tauri::command]
async fn open_har_file(app: tauri::AppHandle) -> Result<Option<HarFile>, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app
        .dialog()
        .file()
        .add_filter("HAR files", &["har"])
        .blocking_pick_file();

    match file_path {
        Some(path) => {
            let path_str = path.to_string();
            match fs::read_to_string(&path_str) {
                Ok(content) => {
                    match parse_har_file(&content) {
                        Ok(requests) => Ok(Some(HarFile {
                            requests,
                            file_path: path_str,
                        })),
                        Err(e) => Err(format!("Failed to parse HAR file: {}", e)),
                    }
                }
                Err(e) => Err(format!("Failed to read file: {}", e)),
            }
        }
        None => Ok(None), // User cancelled
    }
}

#[tauri::command]
async fn load_whitelist_config(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app
        .dialog()
        .file()
        .add_filter("JSON files", &["json"])
        .blocking_pick_file();

    match file_path {
        Some(path) => {
            let path_str = path.to_string();
            match fs::read_to_string(&path_str) {
                Ok(content) => {
                    match parse_whitelist_config(&content) {
                        Ok(config) => {
                            match WHITELIST_CONFIG.lock() {
                                Ok(mut whitelist) => {
                                    *whitelist = config;
                                    Ok(true)
                                }
                                Err(e) => Err(format!("Failed to update whitelist config: {}", e))
                            }
                        }
                        Err(e) => Err(format!("Failed to parse whitelist config: {}", e)),
                    }
                }
                Err(e) => Err(format!("Failed to read file: {}", e)),
            }
        }
        None => Ok(false), // User cancelled
    }
}

#[tauri::command]
fn clear_whitelist_config() -> Result<(), String> {
    match WHITELIST_CONFIG.lock() {
        Ok(mut whitelist) => {
            *whitelist = WhitelistConfig::new();
            Ok(())
        }
        Err(e) => Err(format!("Failed to clear whitelist config: {}", e))
    }
}

#[tauri::command]
fn compare_har_requests(req1: HarRequest, req2: HarRequest, keys_only: bool) -> ComparisonResult {
    match WHITELIST_CONFIG.lock() {
        Ok(whitelist) => compare_requests_with_whitelist(&req1, &req2, keys_only, &whitelist),
        Err(_) => compare_requests(&req1, &req2, keys_only)
    }
}

#[tauri::command]
fn align_har_requests(requests1: Vec<HarRequest>, requests2: Vec<HarRequest>) -> Vec<AlignedPair> {
    let whitelist = WHITELIST_CONFIG.lock().ok();
    align_requests_with_whitelist(&requests1, &requests2, whitelist.as_deref())
}

#[tauri::command]
fn align_har_requests_vscode(requests1: Vec<HarRequest>, requests2: Vec<HarRequest>) -> Vec<AlignedPair> {
    let whitelist = WHITELIST_CONFIG.lock().ok();
    align_requests_like_vscode_with_whitelist(&requests1, &requests2, whitelist.as_deref())
}

#[tauri::command]
fn get_detailed_comparison(req1: HarRequest, req2: HarRequest, keys_only: bool) -> DetailedComparison {
    match WHITELIST_CONFIG.lock() {
        Ok(whitelist) => create_detailed_comparison_with_whitelist(&req1, &req2, keys_only, &whitelist),
        Err(_) => create_detailed_comparison_with_whitelist(&req1, &req2, keys_only, &WhitelistConfig::new())
    }
}

#[tauri::command]
fn store_comparison_data(data_id: String, data: String) -> Result<(), String> {
    match COMPARISON_DATA_STORE.lock() {
        Ok(mut store) => {
            store.insert(data_id, data);
            Ok(())
        }
        Err(e) => Err(format!("Failed to store comparison data: {}", e))
    }
}

#[tauri::command]
fn get_comparison_data(data_id: String) -> Result<Option<String>, String> {
    match COMPARISON_DATA_STORE.lock() {
        Ok(mut store) => {
            Ok(store.remove(&data_id))
        }
        Err(e) => Err(format!("Failed to retrieve comparison data: {}", e))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_har_file,
            load_whitelist_config,
            clear_whitelist_config,
            compare_har_requests,
            align_har_requests,
            align_har_requests_vscode,
            get_detailed_comparison,
            store_comparison_data,
            get_comparison_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
