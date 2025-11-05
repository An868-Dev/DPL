mod database;
mod filesystem;
mod thumbnail;
mod logger;
mod classifier;

use database::{Database, MediaEntry};
use filesystem::{AppPaths, hash_file_content, get_file_extension};
use thumbnail::{generate_image_thumbnail, generate_video_thumbnail, get_video_duration, get_media_resolution};
use logger::Logger;
use classifier::Classifier;

use std::sync::Mutex;
use std::fs;
use std::path::PathBuf;

struct AppState {
    db: Mutex<Option<Database>>,
    paths: Mutex<Option<AppPaths>>,
    logger: Mutex<Option<Logger>>,
    classifier: Mutex<Option<Classifier>>,
}

#[derive(serde::Serialize)]
struct InitResult {
    success: bool,
    message: String,
    data_dir: Option<String>,
    has_model: bool,
    has_database: bool,
}

#[tauri::command]
async fn initialize_app(state: tauri::State<'_, AppState>) -> Result<InitResult, String> {
    // Create app paths
    let paths = AppPaths::new("Anicla")?;
    
    // Ensure directories exist
    paths.ensure_directories()?;
    
    // Check for model
    let has_model = paths.check_model_exists();
    
    // Initialize or open database
    let db_path = paths.db_path();
    let has_database = db_path.exists();
    
    let db = Database::new(db_path.clone())
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    db.init_schema()
        .map_err(|e| format!("Failed to initialize database schema: {}", e))?;
    
    // Initialize logger
    let logger = Logger::new(paths.data_dir.clone())?;
    logger.init_session_log()?;
    logger.write_log("INFO", "Backend", "Application initialized successfully")?;
    logger.write_log("INFO", "Backend", &format!("Database status: {}", if has_database { "existing" } else { "new" }))?;
    logger.write_log("INFO", "Backend", &format!("Model status: {}", if has_model { "found" } else { "not found" }))?;
    
    // Initialize classifier if model exists
    let classifier = if has_model {
        let model_path = paths.model_path("0.1.0");
        match Classifier::new(model_path) {
            Ok(c) => {
                logger.write_log("INFO", "Backend", "Model loaded successfully")?;
                Some(c)
            }
            Err(e) => {
                logger.write_log("ERROR", "Backend", &format!("Failed to load model: {}", e))?;
                None
            }
        }
    } else {
        logger.write_log("WARN", "Backend", "Model not found, classification will be unavailable")?;
        None
    };
    
    let data_dir_str = paths.data_dir.to_string_lossy().to_string();
    
    // Store in app state
    *state.db.lock().unwrap() = Some(db);
    *state.paths.lock().unwrap() = Some(paths);
    *state.logger.lock().unwrap() = Some(logger);
    *state.classifier.lock().unwrap() = classifier;
    
    Ok(InitResult {
        success: true,
        message: "Application initialized successfully".to_string(),
        data_dir: Some(data_dir_str),
        has_model,
        has_database,
    })
}

#[tauri::command]
async fn get_file_size(path: String) -> Result<u64, String> {
    let metadata = fs::metadata(&path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    Ok(metadata.len())
}

#[tauri::command]
async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[derive(serde::Serialize)]
struct ClassifyResult {
    predicted_class: String,
    confidence: f32,
    probabilities: Vec<ClassProbability>,
}

#[derive(serde::Serialize)]
struct ClassProbability {
    class_name: String,
    probability: f32,
}

#[tauri::command]
async fn classify_image(
    hash: String,
    state: tauri::State<'_, AppState>,
) -> Result<ClassifyResult, String> {
    let mut classifier_guard = state.classifier.lock().unwrap();
    let classifier = classifier_guard.as_mut()
        .ok_or("Model not loaded. Please ensure the model file exists.")?;
    
    let paths_guard = state.paths.lock().unwrap();
    let paths = paths_guard.as_ref().ok_or("App not initialized")?;
    
    // Get the hash directory
    let hash_dir = paths.library_path(&hash);
    
    // Find the original image file
    let entries = fs::read_dir(&hash_dir)
        .map_err(|e| format!("Failed to read hash directory: {}", e))?;
    
    let mut image_path = None;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if path.is_file() && !path.file_name().unwrap().to_string_lossy().starts_with("thumb") {
            image_path = Some(path);
            break;
        }
    }
    
    let image_path = image_path.ok_or("No image file found in hash directory")?;
    
    // Run classification
    let (predicted_class, confidence, class_probs) = classifier.classify(image_path)?;
    
    // Convert to response format
    let probabilities = class_probs
        .into_iter()
        .map(|(class_name, probability)| ClassProbability {
            class_name,
            probability,
        })
        .collect();
    
    Ok(ClassifyResult {
        predicted_class,
        confidence,
        probabilities,
    })
}

#[tauri::command]
async fn save_media_file(
    file_data: Vec<u8>,
    original_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let paths_guard = state.paths.lock().unwrap();
    let paths = paths_guard.as_ref().ok_or("App not initialized")?;
    
    // Generate hash for the file
    let hash = hash_file_content(&file_data);
    let extension = get_file_extension(&original_name);
    
    // Create directory for this hash
    let hash_dir = paths.library_path(&hash);
    fs::create_dir_all(&hash_dir)
        .map_err(|e| format!("Failed to create hash directory: {}", e))?;
    
    // Save the original file
    let file_name = format!("{}.{}", hash, extension);
    let file_path = hash_dir.join(&file_name);
    fs::write(&file_path, &file_data)
        .map_err(|e| format!("Failed to save file: {}", e))?;
    
    Ok(hash)
}

#[tauri::command]
async fn generate_thumbnail(
    hash: String,
    is_video: bool,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let paths_guard = state.paths.lock().unwrap();
    let paths = paths_guard.as_ref().ok_or("App not initialized")?;
    
    let hash_dir = paths.library_path(&hash);
    
    // Find the original file
    let entries = fs::read_dir(&hash_dir)
        .map_err(|e| format!("Failed to read hash directory: {}", e))?;
    
    let mut source_path: Option<PathBuf> = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.file_name().unwrap().to_string_lossy().starts_with(&hash) {
            source_path = Some(path);
            break;
        }
    }
    
    let source = source_path.ok_or("Original file not found")?;
    let thumb_path = hash_dir.join("thumbnail.webp");
    
    if is_video {
        generate_video_thumbnail(&source, &thumb_path, 256)?;
    } else {
        generate_image_thumbnail(&source, &thumb_path, 256)?;
    }
    
    Ok(thumb_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn add_media_entry(
    entry: MediaEntry,
    state: tauri::State<'_, AppState>,
) -> Result<i64, String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    
    db.insert_entry(&entry)
        .map_err(|e| format!("Failed to insert entry: {}", e))
}

#[tauri::command]
async fn get_all_media_entries(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MediaEntry>, String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    
    db.get_all_entries()
        .map_err(|e| format!("Failed to get entries: {}", e))
}

#[tauri::command]
async fn delete_media_entry(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    
    db.delete_entry(id)
        .map_err(|e| format!("Failed to delete entry: {}", e))
}

#[tauri::command]
async fn clear_all_history(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let library_dir = {
        let paths_guard = state.paths.lock().unwrap();
        let paths = paths_guard.as_ref().ok_or("App not initialized")?;
        paths.library_dir.clone()
    };

    {
        let db_guard = state.db.lock().unwrap();
        let db = db_guard.as_ref().ok_or("Database not initialized")?;
        db.clear_all_entries()
            .map_err(|e| format!("Failed to clear database entries: {}", e))?;
    }
    
    // Delete all library files
    if library_dir.exists() {
        if let Ok(entries) = fs::read_dir(&library_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Err(e) = fs::remove_dir_all(&path) {
                        eprintln!("Failed to remove directory {:?}: {}", path, e);
                    }
                }
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
async fn get_model_versions(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let paths_guard = state.paths.lock().unwrap();
    let paths = paths_guard.as_ref().ok_or("App not initialized")?;
    
    Ok(paths.get_model_versions())
}

#[tauri::command]
async fn get_data_directory(
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let paths_guard = state.paths.lock().unwrap();
    let paths = paths_guard.as_ref().ok_or("App not initialized")?;
    
    Ok(paths.data_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn reveal_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open path: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn save_config(
    config_json: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let config_path = {
        let paths_guard = state.paths.lock().unwrap();
        let paths = paths_guard.as_ref().ok_or("App not initialized")?;
        paths.data_dir.join("config.json")
    };
    
    fs::write(&config_path, config_json.as_bytes())
        .map_err(|e| format!("Failed to save config: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn load_config(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let config_path = {
        let paths_guard = state.paths.lock().unwrap();
        let paths = paths_guard.as_ref().ok_or("App not initialized")?;
        paths.data_dir.join("config.json")
    };
    
    if !config_path.exists() {
        return Ok("{}".to_string());
    }
    
    fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to load config: {}", e))
}

#[derive(serde::Serialize)]
struct MediaInfo {
    resolution: String,
    duration: Option<f64>,
}

#[tauri::command]
async fn get_media_info(
    hash: String,
    is_video: bool,
    state: tauri::State<'_, AppState>,
) -> Result<MediaInfo, String> {
    let paths_guard = state.paths.lock().unwrap();
    let paths = paths_guard.as_ref().ok_or("App not initialized")?;
    
    let hash_dir = paths.library_path(&hash);
    
    // Find the original file
    let entries = fs::read_dir(&hash_dir)
        .map_err(|e| format!("Failed to read hash directory: {}", e))?;
    
    let mut media_path = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && !path.file_name().unwrap().to_str().unwrap().contains("thumbnail") {
            media_path = Some(path);
            break;
        }
    }
    
    let media_path = media_path.ok_or("Media file not found")?;
    
        let resolution = get_media_resolution(&media_path, is_video)?;
    let duration = if is_video {
        Some(get_video_duration(&media_path)?)
    } else {
        None
    };
    
    Ok(MediaInfo { resolution, duration })
}

#[tauri::command]
async fn write_log(
    level: String,
    source: String,
    message: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let logger_guard = state.logger.lock().unwrap();
    let logger = logger_guard.as_ref().ok_or("Logger not initialized")?;
    
    logger.write_log(&level, &source, &message)
}

#[tauri::command]
async fn get_all_logs(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    let logger_guard = state.logger.lock().unwrap();
    let logger = logger_guard.as_ref().ok_or("Logger not initialized")?;
    
    logger.get_all_logs()
}

#[tauri::command]
async fn export_log(
    log_filename: String,
    export_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let logger_guard = state.logger.lock().unwrap();
    let logger = logger_guard.as_ref().ok_or("Logger not initialized")?;
    
    logger.export_log(&log_filename, PathBuf::from(export_path))
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::Manager;

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[cfg(target_os = "windows")]
use window_vibrancy::apply_blur;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        
        .manage(AppState {
            db: Mutex::new(None),
            paths: Mutex::new(None),
            logger: Mutex::new(None),
            classifier: Mutex::new(None),
        })
        .setup(|app| {
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                if let Err(error) = apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::HudWindow,
                    Some(NSVisualEffectState::Active),
                    None,
                )
                {
                    eprintln!("Failed to apply macOS vibrancy: {:?}", error);
                }

                #[cfg(target_os = "windows")]
                if let Err(error) = apply_blur(&window, Some((18, 18, 18, 125))) {
                    eprintln!("Failed to apply Windows blur: {:?}", error);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            initialize_app,
            get_file_size,
            read_file_bytes,
            classify_image,
            save_media_file,
            generate_thumbnail,
            add_media_entry,
            get_all_media_entries,
            delete_media_entry,
            clear_all_history,
            get_model_versions,
            get_data_directory,
            reveal_path,
            save_config,
            load_config,
            get_media_info,
            write_log,
            get_all_logs,
            export_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
