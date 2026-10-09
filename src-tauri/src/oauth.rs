pub const OAUTH_SCOPES: &str = "openid https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs";

pub fn oauth_client_from_env() -> Result<(String, String), String> {
    resolve_oauth_client(
        std::env::var("ANTIGRAVITY_OAUTH_CLIENT_ID").ok().as_deref(),
        std::env::var("ANTIGRAVITY_OAUTH_CLIENT_SECRET").ok().as_deref(),
        option_env!("ANTIGRAVITY_OAUTH_CLIENT_ID"),
        option_env!("ANTIGRAVITY_OAUTH_CLIENT_SECRET"),
    )
}

pub fn resolve_oauth_client(
    env_client_id: Option<&str>,
    env_client_secret: Option<&str>,
    compiled_client_id: Option<&str>,
    compiled_client_secret: Option<&str>,
) -> Result<(String, String), String> {
    let client_id = first_non_empty(&[env_client_id, compiled_client_id]);
    let client_secret = first_non_empty(&[env_client_secret, compiled_client_secret]);
    match (client_id, client_secret) {
        (Some(client_id), Some(client_secret)) => Ok((client_id, client_secret)),
        _ => Err(
            "Thiếu ANTIGRAVITY_OAUTH_CLIENT_ID hoặc ANTIGRAVITY_OAUTH_CLIENT_SECRET.".into(),
        ),
    }
}

fn first_non_empty(values: &[Option<&str>]) -> Option<String> {
    values
        .iter()
        .copied()
        .flatten()
        .map(str::trim)
        .find(|value| !value.is_empty())
        .map(str::to_string)
}

pub fn build_auth_url(client_id: &str, redirect_uri: &str, state: &str) -> Result<String, String> {
    let mut url = url::Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .map_err(|error| error.to_string())?;
    url.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", OAUTH_SCOPES)
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent")
        .append_pair("include_granted_scopes", "true")
        .append_pair("state", state);
    Ok(url.to_string())
}

pub fn parse_callback_request(request_target: &str) -> Option<(String, String)> {
    let path_and_query = request_target.split_whitespace().nth(1)?;
    let url = url::Url::parse(&format!("http://127.0.0.1{path_and_query}")).ok()?;
    if url.path() != "/auth/callback" {
        return None;
    }
    let code = url.query_pairs().find(|(key, _)| key == "code")?.1.to_string();
    let state = url.query_pairs().find(|(key, _)| key == "state")?.1.to_string();
    if code.is_empty() || state.is_empty() {
        return None;
    }
    Some((code, state))
}

pub const OAUTH_WAIT_SECONDS: u64 = 300;
pub const CALLBACK_HTML: &str = "<!doctype html><meta charset=\"utf-8\"><title>Antigravity Switcher</title><body style=\"font-family:sans-serif;background:#0b1220;color:#e8eefc;padding:32px\">Đăng nhập xong. Bạn có thể đóng tab này.</body>";

pub fn callback_page(locale: &str) -> &'static str {
    if locale == "en" {
        "<!doctype html><meta charset=\"utf-8\"><title>Antigravity Switcher</title><body style=\"font-family:sans-serif;background:#0b1220;color:#e8eefc;padding:32px\">Sign-in finished. You can close this tab.</body>"
    } else {
        CALLBACK_HTML
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_url_uses_loopback_and_offline_consent() {
        let auth_url = build_auth_url(
            "client-123",
            "http://127.0.0.1:54321/auth/callback",
            "state-1",
        )
        .unwrap();
        assert!(auth_url.contains("client_id=client-123"));
        assert!(auth_url.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Fauth%2Fcallback"));
        assert!(auth_url.contains("access_type=offline"));
        assert!(auth_url.contains("prompt=consent"));
        assert!(auth_url.starts_with("https://accounts.google.com/o/oauth2/v2/auth?"));
    }

    #[test]
    fn missing_sources_report_absent_client() {
        let error = resolve_oauth_client(None, None, None, None).unwrap_err();
        assert!(error.contains("ANTIGRAVITY_OAUTH_CLIENT_ID"));
    }

    #[test]
    fn env_client_overrides_compiled_client() {
        let (client_id, client_secret) = resolve_oauth_client(
            Some("env-client-id"),
            Some("env-client-secret"),
            Some("compiled-client-id"),
            Some("compiled-client-secret"),
        )
        .unwrap();
        assert_eq!(client_id, "env-client-id");
        assert_eq!(client_secret, "env-client-secret");
    }

    #[test]
    fn callback_request_yields_code_and_state() {
        let parsed = parse_callback_request("GET /auth/callback?code=abc&state=xyz HTTP/1.1").unwrap();
        assert_eq!(parsed, ("abc".into(), "xyz".into()));
        assert!(parse_callback_request("GET /other?code=abc&state=xyz HTTP/1.1").is_none());
    }
}
