use std::collections::HashMap;

use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QuotaRow {
    pub model_name: String,
    pub window: String,
    pub percent_remaining: i32,
    pub reset_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RefreshFailure {
    Relogin(String),
    KeepSnapshot(String),
}

pub fn normalize_tier(raw_tier: &str) -> Option<String> {
    let lower_tier = raw_tier.trim().to_lowercase();
    if lower_tier.is_empty() {
        return None;
    }
    if lower_tier.contains("ultra") || lower_tier.contains("helium") {
        return Some("ULTRA".into());
    }
    if lower_tier.contains("free") || lower_tier.contains("starter") {
        return Some("FREE".into());
    }
    if lower_tier.contains("pro") || lower_tier.contains("premium") || lower_tier.contains("advanced") {
        return Some("PRO".into());
    }
    None
}

pub fn classify_refresh_failure(status_code: Option<u16>, body_text: &str) -> RefreshFailure {
    let lower_body = body_text.to_lowercase();
    let needs_relogin = status_code == Some(401)
        || lower_body.contains("invalid_grant")
        || lower_body.contains("invalid_client")
        || lower_body.contains("unauthorized_client")
        || lower_body.contains("token expired")
        || lower_body.contains("expired");
    if needs_relogin {
        return RefreshFailure::Relogin(body_text.to_string());
    }
    RefreshFailure::KeepSnapshot(body_text.to_string())
}

#[derive(Debug, Deserialize)]
struct QuotaSummaryResponse {
    #[serde(default)]
    groups: Vec<QuotaSummaryGroup>,
}

#[derive(Debug, Deserialize)]
struct QuotaSummaryGroup {
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(default)]
    buckets: Vec<QuotaSummaryBucket>,
}

#[derive(Debug, Deserialize)]
struct QuotaSummaryBucket {
    #[serde(rename = "bucketId")]
    bucket_id: Option<String>,
    window: Option<String>,
    #[serde(rename = "remainingFraction")]
    remaining_fraction: Option<f64>,
    #[serde(rename = "resetTime")]
    reset_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TierPayload {
    id: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LoadCodeAssistResponse {
    #[serde(rename = "currentTier")]
    current_tier: Option<TierPayload>,
    #[serde(rename = "paidTier")]
    paid_tier: Option<TierPayload>,
}

fn raw_tier_label(tier: &TierPayload) -> Option<String> {
    tier.id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| tier.name.clone().filter(|value| !value.trim().is_empty()))
}

pub fn parse_tier_id(body_text: &str) -> Option<String> {
    let payload: LoadCodeAssistResponse = serde_json::from_str(body_text).ok()?;
    let raw_tier = payload
        .paid_tier
        .as_ref()
        .and_then(raw_tier_label)
        .or_else(|| payload.current_tier.as_ref().and_then(raw_tier_label))?;
    normalize_tier(&raw_tier)
}

fn normalize_window(window_text: &str, bucket_id: &str) -> Option<String> {
    let combined = format!("{window_text} {bucket_id}").to_lowercase();
    if combined.contains("5h") {
        return Some("5h".into());
    }
    if combined.contains("week") || combined.contains("7d") {
        return Some("weekly".into());
    }
    None
}

pub fn antigravity_user_agent(version: &str) -> String {
    format!("vscode/1.X.X (Antigravity/{version})")
}

pub fn load_code_assist_body() -> serde_json::Value {
    serde_json::json!({ "metadata": { "ideType": "ANTIGRAVITY" } })
}

pub const ANTIGRAVITY_CLIENT_VERSION: &str = "2.21.1";

pub const QUOTA_SUMMARY_HOSTS: [&str; 3] = [
    "https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
    "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:retrieveUserQuotaSummary",
    "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
];

pub const TIER_HOSTS: [&str; 3] = [
    "https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
    "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:loadCodeAssist",
    "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
];

pub const MODEL_CATALOG_HOSTS: [&str; 3] = [
    "https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
    "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels",
    "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
];

const CARD_MODEL_SLOTS: &[&[&str]] = &[
    &["gemini-3.1-flash-image"],
    &["gemini-3-flash"],
    &["gemini-3.1-pro-high", "gemini-pro-agent"],
    &["claude-sonnet-4-6"],
];

#[derive(Debug, Deserialize)]
struct CatalogResponse {
    #[serde(default)]
    models: HashMap<String, CatalogModel>,
}

#[derive(Debug, Deserialize)]
struct CatalogModel {
    #[serde(rename = "displayName")]
    display_name: Option<String>,
}

struct SummaryBucket {
    window_name: String,
    percent_remaining: i32,
    reset_at: String,
}

struct SummaryGroup {
    display_name: String,
    buckets: Vec<SummaryBucket>,
}

pub fn quota_rows_from_sources(
    models_body: Option<&str>,
    summary_body: &str,
) -> Result<Vec<QuotaRow>, String> {
    let groups = parse_summary_groups(summary_body)?;
    if let Some(models_body) = models_body {
        if let Ok(catalog) = serde_json::from_str::<CatalogResponse>(models_body) {
            let model_rows = fuse_card_models(&catalog.models, &groups);
            if !model_rows.is_empty() {
                return Ok(model_rows);
            }
        }
    }
    Ok(group_quota_rows(&groups))
}

fn parse_summary_groups(body_text: &str) -> Result<Vec<SummaryGroup>, String> {
    let summary: QuotaSummaryResponse =
        serde_json::from_str(body_text).map_err(|error| error.to_string())?;
    let mut groups = Vec::new();
    for group in summary.groups {
        let mut buckets = Vec::new();
        for bucket in group.buckets {
            let Some(window_name) = normalize_window(
                bucket.window.as_deref().unwrap_or(""),
                bucket.bucket_id.as_deref().unwrap_or(""),
            ) else {
                continue;
            };
            let Some(remaining_fraction) = bucket.remaining_fraction else {
                continue;
            };
            let Some(reset_at) = bucket.reset_time.filter(|value| !value.trim().is_empty()) else {
                continue;
            };
            buckets.push(SummaryBucket {
                window_name,
                percent_remaining: ((remaining_fraction * 100.0).round() as i32).clamp(0, 100),
                reset_at,
            });
        }
        groups.push(SummaryGroup {
            display_name: group.display_name.unwrap_or_default(),
            buckets,
        });
    }
    Ok(groups)
}

fn fuse_card_models(catalog: &HashMap<String, CatalogModel>, groups: &[SummaryGroup]) -> Vec<QuotaRow> {
    let mut quota_rows = Vec::new();
    for slot in CARD_MODEL_SLOTS {
        let Some(model_id) = slot.iter().find(|model_id| catalog.contains_key(**model_id)) else {
            continue;
        };
        let display_name = catalog
            .get(*model_id)
            .and_then(|model| model.display_name.clone())
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| (*model_id).to_string());
        let Some(group) = groups.iter().find(|group| group_matches_model(model_id, &group.display_name)) else {
            continue;
        };
        for bucket in &group.buckets {
            quota_rows.push(QuotaRow {
                model_name: display_name.clone(),
                window: bucket.window_name.clone(),
                percent_remaining: bucket.percent_remaining,
                reset_at: bucket.reset_at.clone(),
            });
        }
    }
    quota_rows
}

fn group_matches_model(model_id: &str, group_name: &str) -> bool {
    let model_key = model_id.to_lowercase();
    let group_key = group_name.to_lowercase();
    let is_claude_or_gpt = model_key.starts_with("claude") || model_key.starts_with("gpt");
    let is_gemini = model_key.starts_with("gemini");
    if is_claude_or_gpt {
        return group_key.contains("claude") || group_key.contains("gpt") || group_key.contains("3p");
    }
    if is_gemini {
        return group_key.contains("gemini")
            || (!group_key.contains("claude") && !group_key.contains("gpt") && !group_key.contains("3p"));
    }
    false
}

fn group_quota_rows(groups: &[SummaryGroup]) -> Vec<QuotaRow> {
    let mut quota_rows = Vec::new();
    for group in groups {
        let model_name = if group.display_name.trim().is_empty() {
            "Model".to_string()
        } else {
            group.display_name.clone()
        };
        for bucket in &group.buckets {
            quota_rows.push(QuotaRow {
                model_name: model_name.clone(),
                window: bucket.window_name.clone(),
                percent_remaining: bucket.percent_remaining,
                reset_at: bucket.reset_at.clone(),
            });
        }
    }
    quota_rows
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cloud_code_requests_identify_as_antigravity() {
        let user_agent = antigravity_user_agent("2.21.1");
        assert_eq!(user_agent, "vscode/1.X.X (Antigravity/2.21.1)");
        assert!(user_agent.contains("Antigravity"));
        assert_eq!(
            load_code_assist_body()["metadata"]["ideType"],
            "ANTIGRAVITY"
        );
    }

    #[test]
    fn paid_tier_overrides_the_active_free_tier() {
        let body = r#"{
          "currentTier": {"id": "free-tier", "name": "Antigravity"},
          "paidTier": {"id": "g1-pro-tier", "name": "Google AI Pro"}
        }"#;
        assert_eq!(parse_tier_id(body).as_deref(), Some("PRO"));
        let free_only = r#"{"currentTier": {"id": "free-tier", "name": "Antigravity"}}"#;
        assert_eq!(parse_tier_id(free_only).as_deref(), Some("FREE"));
    }

    #[test]
    fn tier_and_quota_rows_follow_the_spec() {
        assert_eq!(normalize_tier("g1-pro-tier").as_deref(), Some("PRO"));
        assert_eq!(normalize_tier("g1-ultra-tier").as_deref(), Some("ULTRA"));
        assert_eq!(normalize_tier("free-tier").as_deref(), Some("FREE"));
        assert_eq!(normalize_tier("standard-tier"), None);

        let body = r#"{
          "groups": [{
            "displayName": "Gemini",
            "buckets": [
              {"bucketId": "gemini-5h", "window": "5h", "remainingFraction": 0.985, "resetTime": "2026-10-09T12:00:00Z", "displayName": "Gemini 3 Flash"},
              {"bucketId": "claude-weekly", "window": "weekly", "remainingFraction": 0.08, "resetTime": "2026-10-16T12:00:00Z", "displayName": "Claude Sonnet 4.6"},
              {"bucketId": "other", "window": "daily", "remainingFraction": 1, "resetTime": "2026-10-10T12:00:00Z"}
            ]
          }]
        }"#;
        let rows = quota_rows_from_sources(None, body).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].percent_remaining, 99);
        assert_eq!(rows[0].window, "5h");
        assert_eq!(rows[1].window, "weekly");
        assert_eq!(rows[1].percent_remaining, 8);
    }

    #[test]
    fn model_rows_use_catalog_names_and_shared_group_quota() {
        let summary = r#"{
          "groups": [
            {"displayName": "Gemini Models", "buckets": [
              {"bucketId": "gemini-weekly", "window": "weekly", "remainingFraction": 0.87, "resetTime": "2026-10-15T07:00:00Z", "displayName": "Weekly Limit Remaining"},
              {"bucketId": "gemini-5h", "window": "5h", "remainingFraction": 1, "resetTime": "2026-10-09T21:30:00Z", "displayName": "Five Hour Limit Remaining"}
            ]},
            {"displayName": "Claude and GPT models", "buckets": [
              {"bucketId": "claude-weekly", "window": "weekly", "remainingFraction": 0.49, "resetTime": "2026-10-15T07:00:00Z", "displayName": "Weekly Limit Remaining"},
              {"bucketId": "claude-5h", "window": "5h", "remainingFraction": 1, "resetTime": "2026-10-09T21:40:00Z", "displayName": "Five Hour Limit Remaining"}
            ]}
          ]
        }"#;
        let models = r#"{
          "models": {
            "gemini-3.8-flash-low": {"displayName": "Gemini 3.8 Flash (Low)"},
            "gemini-3.1-flash-image": {"displayName": "Gemini 3.1 Flash Image"},
            "gemini-3-flash": {"displayName": "Gemini 3 Flash"},
            "gemini-pro-agent": {"displayName": "Gemini 3.1 Pro (High)"},
            "claude-sonnet-4-6": {"displayName": "Claude Sonnet 4.6 (Thinking)"}
          }
        }"#;
        let rows = quota_rows_from_sources(Some(models), summary).unwrap();
        let five_hour: Vec<_> = rows
            .iter()
            .filter(|row| row.window == "5h")
            .map(|row| (row.model_name.as_str(), row.percent_remaining, row.reset_at.as_str()))
            .collect();
        assert_eq!(
            five_hour,
            vec![
                ("Gemini 3.1 Flash Image", 100, "2026-10-09T21:30:00Z"),
                ("Gemini 3 Flash", 100, "2026-10-09T21:30:00Z"),
                ("Gemini 3.1 Pro (High)", 100, "2026-10-09T21:30:00Z"),
                ("Claude Sonnet 4.6 (Thinking)", 100, "2026-10-09T21:40:00Z"),
            ]
        );
        let weekly: Vec<_> = rows
            .iter()
            .filter(|row| row.window == "weekly")
            .map(|row| (row.model_name.as_str(), row.percent_remaining))
            .collect();
        assert_eq!(
            weekly,
            vec![
                ("Gemini 3.1 Flash Image", 87),
                ("Gemini 3 Flash", 87),
                ("Gemini 3.1 Pro (High)", 87),
                ("Claude Sonnet 4.6 (Thinking)", 49),
            ]
        );
    }

    #[test]
    fn missing_catalog_labels_groups_instead_of_bucket_titles() {
        let summary = r#"{
          "groups": [
            {"displayName": "Gemini Models", "buckets": [
              {"bucketId": "gemini-5h", "window": "5h", "remainingFraction": 1, "resetTime": "2026-10-09T21:30:00Z", "displayName": "Five Hour Limit Remaining"}
            ]},
            {"displayName": "Claude and GPT models", "buckets": [
              {"bucketId": "claude-weekly", "window": "weekly", "remainingFraction": 0.49, "resetTime": "2026-10-15T07:00:00Z", "displayName": "Weekly Limit Remaining"}
            ]}
          ]
        }"#;
        let rows = quota_rows_from_sources(None, summary).unwrap();
        assert_eq!(rows[0].model_name, "Gemini Models");
        assert_eq!(rows[1].model_name, "Claude and GPT models");
        assert!(rows.iter().all(|row| !row.model_name.contains("Limit Remaining")));
    }

    #[test]
    fn refresh_failure_class_splits_relogin_from_snapshot() {
        assert!(matches!(
            classify_refresh_failure(Some(401), "nope"),
            RefreshFailure::Relogin(_)
        ));
        assert!(matches!(
            classify_refresh_failure(Some(400), "invalid_grant"),
            RefreshFailure::Relogin(_)
        ));
        assert!(matches!(
            classify_refresh_failure(Some(429), "too many"),
            RefreshFailure::KeepSnapshot(_)
        ));
        assert!(matches!(
            classify_refresh_failure(None, "connection reset"),
            RefreshFailure::KeepSnapshot(_)
        ));
    }
}
