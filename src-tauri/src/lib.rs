use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Emitter, Manager, RunEvent, WindowEvent,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use std::fs;
use std::path::PathBuf;

#[tauri::command]
fn backup_database(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let desktop_dir = app.path().desktop_dir().map_err(|e| e.to_string())?;

    let db_path = app_data_dir.join("cd_app.db");
    if !db_path.exists() {
        return Err("Database file not found".into());
    }

    let backup_dir = desktop_dir.join("cam-do-55").join("camdo-55-backup");
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    }

    let backup_path = backup_dir.join(&filename);
    fs::copy(&db_path, &backup_path).map_err(|e| e.to_string())?;

    Ok(backup_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn restore_database(app: tauri::AppHandle, backup_path_str: String) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("cd_app.db");

    let backup_path = PathBuf::from(backup_path_str);
    if !backup_path.exists() {
        return Err("Backup file not found".into());
    }

    // Backup the current db before overwriting just in case
    let failsafe_path = app_data_dir.join("cd_app_failsafe.db");
    if db_path.exists() {
        let _ = fs::copy(&db_path, &failsafe_path);
    }

    // Overwrite the database
    fs::copy(&backup_path, &db_path).map_err(|e| e.to_string())?;

    Ok("Database restored successfully".into())
}

#[tauri::command]
fn export_report(
    app: tauri::AppHandle,
    filename: String,
    content: String,
) -> Result<String, String> {
    let desktop_dir = app.path().desktop_dir().map_err(|e| e.to_string())?;

    let report_dir = desktop_dir.join("cam-do-55").join("camdo-55-report");
    if !report_dir.exists() {
        fs::create_dir_all(&report_dir).map_err(|e| e.to_string())?;
    }

    let report_path = report_dir.join(&filename);
    fs::write(&report_path, content).map_err(|e| e.to_string())?;

    Ok(report_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,\"{}\"", path))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let toggle_i = MenuItemBuilder::with_id("toggle", "Mở Giao Diện").build(app)?;
            let create_contract_i =
                MenuItemBuilder::with_id("create_contract", "Lập Hợp Đồng").build(app)?;
            let quit_i = MenuItemBuilder::with_id("quit", "Thoát Hoàn Toàn Ứng Dụng").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&toggle_i, &create_contract_i, &quit_i])
                .build()?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Cầm Đồ 55")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "create_contract" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("open-create-contract", ());
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                // Prevent window from closing, hide it instead
                let _ = window.hide();
                api.prevent_close();
            }
            _ => {}
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            backup_database,
            restore_database,
            export_report,
            open_folder
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            RunEvent::Reopen { .. } | RunEvent::Opened { .. } => {
                // When clicking dock icon on macOS
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        });
}
