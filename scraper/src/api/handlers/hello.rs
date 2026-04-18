pub async fn hello() -> Result<String, axum::http::StatusCode> {
    Ok("\nHello world!\n\n".to_string())
}
