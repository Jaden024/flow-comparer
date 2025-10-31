use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarRequest {
    pub method: String,
    pub url: String,
    pub path: String,
    pub headers: HashMap<String, String>,
    pub query_params: HashMap<String, Vec<String>>,
    pub post_data: Option<String>,
    pub response_status: u16,
    pub response_headers: HashMap<String, String>,
    pub response_body: Option<String>,
    pub index: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HarFile {
    pub requests: Vec<HarRequest>,
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComparisonResult {
    pub status: String, // "match", "partial", "different", "whitelisted"
    pub details: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AlignedPair {
    pub index1: Option<usize>,
    pub index2: Option<usize>,
    pub comparison: Option<ComparisonResult>,
}

// Whitelist configuration structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhitelistConfig {
    pub global: Option<WhitelistRules>,
    pub local: Option<Vec<LocalWhitelistRule>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhitelistRules {
    pub headers: Option<Vec<String>>,
    pub payload_keys: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalWhitelistRule {
    pub host: Option<String>,
    pub url: Option<String>,
    pub headers: Option<Vec<String>>,
    pub payload_keys: Option<Vec<String>>,
}

impl WhitelistConfig {
    pub fn new() -> Self {
        WhitelistConfig {
            global: None,
            local: None,
        }
    }

    // Check if a header is whitelisted for a given URL
    pub fn is_header_whitelisted(&self, header_name: &str, url: &str) -> bool {
        // Check local rules first
        if let Some(local_rules) = &self.local {
            for rule in local_rules {
                if self.rule_matches_url(rule, url) {
                    if let Some(headers) = &rule.headers {
                        if headers.iter().any(|h| h.eq_ignore_ascii_case(header_name)) {
                            return true;
                        }
                    }
                }
            }
        }

        // Check global rules
        if let Some(global) = &self.global {
            if let Some(headers) = &global.headers {
                if headers.iter().any(|h| h.eq_ignore_ascii_case(header_name)) {
                    return true;
                }
            }
        }

        false
    }

    // Check if a payload key is whitelisted for a given URL
    pub fn is_payload_key_whitelisted(&self, key_name: &str, url: &str) -> bool {
        // Check local rules first
        if let Some(local_rules) = &self.local {
            for rule in local_rules {
                if self.rule_matches_url(rule, url) {
                    if let Some(payload_keys) = &rule.payload_keys {
                        if payload_keys.contains(&key_name.to_string()) {
                            return true;
                        }
                    }
                }
            }
        }

        // Check global rules
        if let Some(global) = &self.global {
            if let Some(payload_keys) = &global.payload_keys {
                if payload_keys.contains(&key_name.to_string()) {
                    return true;
                }
            }
        }

        false
    }

    fn rule_matches_url(&self, rule: &LocalWhitelistRule, url: &str) -> bool {
        // Match by URL if specified
        if let Some(rule_url) = &rule.url {
            if url.contains(rule_url) {
                return true;
            }
        }

        // Match by host if specified
        if let Some(rule_host) = &rule.host {
            if let Ok(parsed_url) = Url::parse(url) {
                if let Some(host) = parsed_url.host_str() {
                    if host.contains(rule_host) {
                        return true;
                    }
                }
            }
        }

        false
    }
}

// Raw HAR format structures for parsing
#[derive(Debug, Deserialize)]
struct RawHar {
    log: RawLog,
}

#[derive(Debug, Deserialize)]
struct RawLog {
    entries: Vec<RawEntry>,
}

#[derive(Debug, Deserialize)]
struct RawEntry {
    request: RawRequest,
    response: RawResponse,
}

#[derive(Debug, Deserialize)]
struct RawRequest {
    method: String,
    url: String,
    headers: Vec<RawHeader>,
    #[serde(rename = "queryString")]
    query_string: Option<Vec<RawQueryParam>>,
    #[serde(rename = "postData")]
    post_data: Option<RawPostData>,
}

#[derive(Debug, Deserialize)]
struct RawResponse {
    status: u16,
    headers: Vec<RawHeader>,
    content: Option<RawContent>,
}

#[derive(Debug, Deserialize)]
struct RawHeader {
    name: String,
    value: String,
}

#[derive(Debug, Deserialize)]
struct RawQueryParam {
    name: String,
    value: String,
}

#[derive(Debug, Deserialize)]
struct RawPostData {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawContent {
    text: Option<String>,
}

impl HarRequest {
    fn from_raw_entry(entry: &RawEntry, index: usize) -> Result<Self, Box<dyn std::error::Error>> {
        let request = &entry.request;
        let response = &entry.response;

        // Parse URL and extract path
        let url = &request.url;
        let parsed_url = Url::parse(url)?;
        let mut path = parsed_url.path().to_string();
        if let Some(query) = parsed_url.query() {
            path.push('?');
            path.push_str(query);
        }

        // Convert headers to HashMap
        let mut headers = HashMap::new();
        for header in &request.headers {
            headers.insert(header.name.clone(), header.value.clone());
        }

        // Convert query parameters to HashMap
        let mut query_params = HashMap::new();
        if let Some(query_string) = &request.query_string {
            for param in query_string {
                query_params
                    .entry(param.name.clone())
                    .or_insert_with(Vec::new)
                    .push(param.value.clone());
            }
        }

        // Extract POST data
        let post_data = request.post_data.as_ref().and_then(|pd| pd.text.clone());

        // Convert response headers to HashMap
        let mut response_headers = HashMap::new();
        for header in &response.headers {
            response_headers.insert(header.name.clone(), header.value.clone());
        }

        // Extract response body
        let response_body = response.content.as_ref().and_then(|c| c.text.clone());

        Ok(HarRequest {
            method: request.method.clone(),
            url: url.clone(),
            path,
            headers,
            query_params,
            post_data,
            response_status: response.status,
            response_headers,
            response_body,
            index,
        })
    }
}

pub fn parse_har_file(content: &str) -> Result<Vec<HarRequest>, Box<dyn std::error::Error>> {
    let raw_har: RawHar = serde_json::from_str(content)?;
    let mut requests = Vec::new();

    for (index, entry) in raw_har.log.entries.iter().enumerate() {
        match HarRequest::from_raw_entry(entry, index + 1) { // Start index from 1
            Ok(request) => requests.push(request),
            Err(e) => {
                eprintln!("Warning: Failed to parse entry {}: {}", index + 1, e);
                // Continue parsing other entries
            }
        }
    }

    Ok(requests)
}

pub fn parse_whitelist_config(content: &str) -> Result<WhitelistConfig, Box<dyn std::error::Error>> {
    let config: WhitelistConfig = serde_json::from_str(content)?;
    Ok(config)
}

pub fn compare_requests(req1: &HarRequest, req2: &HarRequest, keys_only: bool) -> ComparisonResult {
    compare_requests_with_whitelist(req1, req2, keys_only, &WhitelistConfig::new())
}

pub fn compare_requests_with_whitelist(
    req1: &HarRequest,
    req2: &HarRequest,
    _keys_only: bool,
    whitelist: &WhitelistConfig,
) -> ComparisonResult {
    // For GET requests, compare only the path without query parameters
    // For other methods, compare the full path
    let path1 = if req1.method.to_uppercase() == "GET" {
        req1.path.split('?').next().unwrap_or(&req1.path)
    } else {
        &req1.path
    };

    let path2 = if req2.method.to_uppercase() == "GET" {
        req2.path.split('?').next().unwrap_or(&req2.path)
    } else {
        &req2.path
    };

    if path1 != path2 {
        return ComparisonResult {
            status: "different".to_string(),
            details: "Different paths".to_string(),
        };
    }

    // Check for differences while tracking whitelisted differences
    let mut has_non_whitelisted_diff = false;
    let mut has_whitelisted_diff = false;

    // Compare headers
    let headers_diff = compare_headers_with_whitelist(&req1.headers, &req2.headers, &req1.url, whitelist);
    if headers_diff.has_non_whitelisted_diff {
        has_non_whitelisted_diff = true;
    }
    if headers_diff.has_whitelisted_diff {
        has_whitelisted_diff = true;
    }

    // Compare query params (skip for GET requests)
    if req1.method.to_uppercase() != "GET" {
        if req1.query_params != req2.query_params {
            has_non_whitelisted_diff = true;
        }
    }

    // Compare post data with whitelist consideration
    if let (Some(data1), Some(data2)) = (&req1.post_data, &req2.post_data) {
        let payload_diff = compare_payload_with_whitelist(data1, data2, &req1.url, whitelist);
        if payload_diff.has_non_whitelisted_diff {
            has_non_whitelisted_diff = true;
        }
        if payload_diff.has_whitelisted_diff {
            has_whitelisted_diff = true;
        }
    } else if req1.post_data != req2.post_data {
        has_non_whitelisted_diff = true;
    }

    // Method comparison
    if req1.method != req2.method {
        has_non_whitelisted_diff = true;
    }

    // Determine final status
    if !has_non_whitelisted_diff && !has_whitelisted_diff {
        ComparisonResult {
            status: "match".to_string(),
            details: "Full match".to_string(),
        }
    } else if !has_non_whitelisted_diff && has_whitelisted_diff {
        ComparisonResult {
            status: "whitelisted".to_string(),
            details: "Differences only in whitelisted fields".to_string(),
        }
    } else if has_non_whitelisted_diff {
        ComparisonResult {
            status: "partial".to_string(),
            details: "Has differences".to_string(),
        }
    } else {
        ComparisonResult {
            status: "partial".to_string(),
            details: "Partial match".to_string(),
        }
    }
}

struct DiffResult {
    has_non_whitelisted_diff: bool,
    has_whitelisted_diff: bool,
}

fn compare_headers_with_whitelist(
    headers1: &HashMap<String, String>,
    headers2: &HashMap<String, String>,
    url: &str,
    whitelist: &WhitelistConfig,
) -> DiffResult {
    let mut result = DiffResult {
        has_non_whitelisted_diff: false,
        has_whitelisted_diff: false,
    };

    let all_keys: HashSet<&String> = headers1.keys().chain(headers2.keys()).collect();

    for key in all_keys {
        let val1 = headers1.get(key);
        let val2 = headers2.get(key);

        if val1 != val2 {
            if whitelist.is_header_whitelisted(key, url) {
                result.has_whitelisted_diff = true;
            } else {
                result.has_non_whitelisted_diff = true;
            }
        }
    }

    result
}

fn compare_payload_with_whitelist(
    payload1: &str,
    payload2: &str,
    url: &str,
    whitelist: &WhitelistConfig,
) -> DiffResult {
    let mut result = DiffResult {
        has_non_whitelisted_diff: false,
        has_whitelisted_diff: false,
    };

    // Try to parse as JSON and compare keys
    if let (Ok(json1), Ok(json2)) = (
        serde_json::from_str::<serde_json::Value>(payload1),
        serde_json::from_str::<serde_json::Value>(payload2),
    ) {
        compare_json_values(&json1, &json2, url, whitelist, &mut result, "");
    } else {
        // If not JSON, do simple string comparison
        if payload1 != payload2 {
            result.has_non_whitelisted_diff = true;
        }
    }

    result
}

fn compare_json_values(
    val1: &serde_json::Value,
    val2: &serde_json::Value,
    url: &str,
    whitelist: &WhitelistConfig,
    result: &mut DiffResult,
    path: &str,
) {
    match (val1, val2) {
        (serde_json::Value::Object(obj1), serde_json::Value::Object(obj2)) => {
            let all_keys: HashSet<&String> = obj1.keys().chain(obj2.keys()).collect();

            for key in all_keys {
                let current_path = if path.is_empty() {
                    key.clone()
                } else {
                    format!("{}.{}", path, key)
                };

                let v1 = obj1.get(key);
                let v2 = obj2.get(key);

                match (v1, v2) {
                    (Some(val1), Some(val2)) => {
                        if val1 != val2 {
                            // Check if this key is whitelisted
                            if whitelist.is_payload_key_whitelisted(key, url) {
                                result.has_whitelisted_diff = true;
                            } else {
                                // Recursively check nested objects
                                compare_json_values(val1, val2, url, whitelist, result, &current_path);
                            }
                        }
                    }
                    (None, Some(_)) | (Some(_), None) => {
                        // Key exists in only one object
                        if whitelist.is_payload_key_whitelisted(key, url) {
                            result.has_whitelisted_diff = true;
                        } else {
                            result.has_non_whitelisted_diff = true;
                        }
                    }
                    _ => {}
                }
            }
        }
        (serde_json::Value::Array(arr1), serde_json::Value::Array(arr2)) => {
            if arr1 != arr2 {
                result.has_non_whitelisted_diff = true;
            }
        }
        _ => {
            if val1 != val2 {
                result.has_non_whitelisted_diff = true;
            }
        }
    }
}

pub fn align_requests(requests1: &[HarRequest], requests2: &[HarRequest]) -> Vec<AlignedPair> {
    align_requests_with_whitelist(requests1, requests2, None)
}

pub fn align_requests_with_whitelist(
    requests1: &[HarRequest],
    requests2: &[HarRequest],
    whitelist: Option<&WhitelistConfig>,
) -> Vec<AlignedPair> {
    let default_config = WhitelistConfig::new();
    let config = whitelist.unwrap_or(&default_config);

    // Simple alignment algorithm - match by path
    let mut aligned = Vec::new();
    let mut used2 = vec![false; requests2.len()];

    for (i, req1) in requests1.iter().enumerate() {
        let mut found_match = false;

        // Look for matching path in requests2
        for (j, req2) in requests2.iter().enumerate() {
            if !used2[j] && req1.path == req2.path {
                used2[j] = true;
                aligned.push(AlignedPair {
                    index1: Some(i),
                    index2: Some(j),
                    comparison: Some(compare_requests_with_whitelist(req1, req2, false, config)),
                });
                found_match = true;
                break;
            }
        }

        if !found_match {
            aligned.push(AlignedPair {
                index1: Some(i),
                index2: None,
                comparison: None,
            });
        }
    }

    // Interleave unmatched requests from requests2 into their proper positions
    // Instead of appending them all at the end
    for (j, _) in requests2.iter().enumerate() {
        if !used2[j] {
            // Find the correct position to insert this unmatched right-side request
            // It should go after the last pair with index2 < j, and before the first with index2 > j
            let insert_pos = aligned.iter().position(|pair| {
                if let Some(idx2) = pair.index2 {
                    idx2 > j
                } else {
                    false
                }
            }).unwrap_or(aligned.len());

            aligned.insert(insert_pos, AlignedPair {
                index1: None,
                index2: Some(j),
                comparison: None,
            });
        }
    }

    aligned
}

// VS Code-like alignment using sequence matching
pub fn align_requests_like_vscode(requests1: &[HarRequest], requests2: &[HarRequest]) -> Vec<AlignedPair> {
    align_requests_like_vscode_with_whitelist(requests1, requests2, None)
}

pub fn align_requests_like_vscode_with_whitelist(
    requests1: &[HarRequest],
    requests2: &[HarRequest],
    whitelist: Option<&WhitelistConfig>,
) -> Vec<AlignedPair> {
    let default_config = WhitelistConfig::new();
    let config = whitelist.unwrap_or(&default_config);

    // Create path sequences for comparison
    let paths1: Vec<&str> = requests1.iter().map(|r| r.path.as_str()).collect();
    let paths2: Vec<&str> = requests2.iter().map(|r| r.path.as_str()).collect();

    // Improved LCS-based alignment
    let mut aligned = Vec::new();
    let mut i = 0;
    let mut j = 0;

    while i < paths1.len() || j < paths2.len() {
        if i >= paths1.len() {
            // Exhausted list1, add remaining items from list2
            aligned.push(AlignedPair {
                index1: None,
                index2: Some(j),
                comparison: None,
            });
            j += 1;
        } else if j >= paths2.len() {
            // Exhausted list2, add remaining items from list1
            aligned.push(AlignedPair {
                index1: Some(i),
                index2: None,
                comparison: None,
            });
            i += 1;
        } else if paths1[i] == paths2[j] {
            // Match found at current position
            let comparison = Some(compare_requests_with_whitelist(&requests1[i], &requests2[j], false, config));
            aligned.push(AlignedPair {
                index1: Some(i),
                index2: Some(j),
                comparison,
            });
            i += 1;
            j += 1;
        } else {
            // No match at current position - look ahead to decide what to do
            let path1_in_list2 = paths2[j..].iter().position(|&p| p == paths1[i]);
            let path2_in_list1 = paths1[i..].iter().position(|&p| p == paths2[j]);

            match (path1_in_list2, path2_in_list1) {
                (Some(pos1), Some(pos2)) => {
                    // Both items appear later in the other list
                    // Choose the one that appears sooner
                    if pos1 <= pos2 {
                        // Current item from list2 appears sooner in list1, so insert it as unmatched
                        aligned.push(AlignedPair {
                            index1: None,
                            index2: Some(j),
                            comparison: None,
                        });
                        j += 1;
                    } else {
                        // Current item from list1 appears sooner in list2, so insert it as unmatched
                        aligned.push(AlignedPair {
                            index1: Some(i),
                            index2: None,
                            comparison: None,
                        });
                        i += 1;
                    }
                }
                (Some(_), None) => {
                    // List1 item appears later in list2, but list2 item doesn't appear in list1
                    // Insert list2 item as unmatched
                    aligned.push(AlignedPair {
                        index1: None,
                        index2: Some(j),
                        comparison: None,
                    });
                    j += 1;
                }
                (None, Some(_)) => {
                    // List2 item appears later in list1, but list1 item doesn't appear in list2
                    // Insert list1 item as unmatched
                    aligned.push(AlignedPair {
                        index1: Some(i),
                        index2: None,
                        comparison: None,
                    });
                    i += 1;
                }
                (None, None) => {
                    // Neither item appears in the other list
                    // Insert left item as unmatched
                    aligned.push(AlignedPair {
                        index1: Some(i),
                        index2: None,
                        comparison: None,
                    });
                    i += 1;
                    // Also insert right item as unmatched if j is still in bounds
                    if j < paths2.len() {
                        aligned.push(AlignedPair {
                            index1: None,
                            index2: Some(j),
                            comparison: None,
                        });
                        j += 1;
                    }
                }
            }
        }
    }

    aligned
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DetailedComparison {
    pub general: ComparisonSection,
    pub raw_request: ComparisonSection,
    pub headers: ComparisonSection,
    pub payloads: Option<ComparisonSection>,
    pub params: ComparisonSection,
    pub response: ComparisonSection,
    pub response_body: Option<ComparisonSection>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComparisonSection {
    pub content1: String,
    pub content2: String,
    pub differences: Vec<DiffLine>,
    pub whitelisted_keys: Vec<String>, // Keys/headers that are whitelisted
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiffLine {
    pub line_number: usize,
    pub diff_type: String, // "same", "different", "missing", "whitelisted"
    pub content: String,
}

pub fn create_detailed_comparison(req1: &HarRequest, req2: &HarRequest, keys_only: bool) -> DetailedComparison {
    create_detailed_comparison_with_whitelist(req1, req2, keys_only, &WhitelistConfig::new())
}

pub fn create_detailed_comparison_with_whitelist(
    req1: &HarRequest,
    req2: &HarRequest,
    keys_only: bool,
    whitelist: &WhitelistConfig,
) -> DetailedComparison {
    DetailedComparison {
        general: create_general_section(req1, req2, whitelist),
        raw_request: create_raw_request_section(req1, req2, whitelist),
        headers: create_headers_section(req1, req2, keys_only, whitelist),
        payloads: create_payloads_section(req1, req2, whitelist),
        params: create_params_section(req1, req2, keys_only, whitelist),
        response: create_response_section(req1, req2, keys_only, whitelist),
        response_body: create_response_body_section(req1, req2, whitelist),
    }
}

fn create_general_section(req1: &HarRequest, req2: &HarRequest, _whitelist: &WhitelistConfig) -> ComparisonSection {
    let content1 = format!(
        "Index: {}\nMethod: {}\nURL: {}\nPath: {}\nResponse Status: {}",
        req1.index, req1.method, req1.url, req1.path, req1.response_status
    );
    let content2 = format!(
        "Index: {}\nMethod: {}\nURL: {}\nPath: {}\nResponse Status: {}",
        req2.index, req2.method, req2.url, req2.path, req2.response_status
    );

    ComparisonSection {
        content1,
        content2,
        differences: vec![],
        whitelisted_keys: vec![],
    }
}

fn create_headers_section(req1: &HarRequest, req2: &HarRequest, _keys_only: bool, whitelist: &WhitelistConfig) -> ComparisonSection {
    let content1 = format_headers(&req1.headers);
    let content2 = format_headers(&req2.headers);

    // Collect whitelisted header names
    let mut whitelisted_keys = Vec::new();
    let all_keys: HashSet<&String> = req1.headers.keys().chain(req2.headers.keys()).collect();
    for key in all_keys {
        if whitelist.is_header_whitelisted(key, &req1.url) {
            whitelisted_keys.push(key.to_lowercase());
        }
    }

    ComparisonSection {
        content1,
        content2,
        differences: vec![],
        whitelisted_keys,
    }
}

fn create_params_section(req1: &HarRequest, req2: &HarRequest, _keys_only: bool, _whitelist: &WhitelistConfig) -> ComparisonSection {
    let content1 = format_params(&req1.query_params);
    let content2 = format_params(&req2.query_params);

    ComparisonSection {
        content1,
        content2,
        differences: vec![],
        whitelisted_keys: vec![],
    }
}



fn create_response_section(req1: &HarRequest, req2: &HarRequest, _keys_only: bool, whitelist: &WhitelistConfig) -> ComparisonSection {
    let content1 = format!(
        "Status: {}\n\nHeaders:\n{}\n\nBody:\n{}",
        req1.response_status,
        format_headers(&req1.response_headers),
        req1.response_body.as_ref().map_or("No body".to_string(), |body| format_json_string(body))
    );
    let content2 = format!(
        "Status: {}\n\nHeaders:\n{}\n\nBody:\n{}",
        req2.response_status,
        format_headers(&req2.response_headers),
        req2.response_body.as_ref().map_or("No body".to_string(), |body| format_json_string(body))
    );

    // Collect whitelisted response header names
    let mut whitelisted_keys = Vec::new();
    let all_keys: HashSet<&String> = req1.response_headers.keys().chain(req2.response_headers.keys()).collect();
    for key in all_keys {
        if whitelist.is_header_whitelisted(key, &req1.url) {
            whitelisted_keys.push(key.to_lowercase());
        }
    }

    ComparisonSection {
        content1,
        content2,
        differences: vec![],
        whitelisted_keys,
    }
}

fn create_raw_request_section(req1: &HarRequest, req2: &HarRequest, whitelist: &WhitelistConfig) -> ComparisonSection {
    let content1 = format_raw_request(req1);
    let content2 = format_raw_request(req2);

    // Collect whitelisted header names for raw request
    let mut whitelisted_keys = Vec::new();
    let all_keys: HashSet<&String> = req1.headers.keys().chain(req2.headers.keys()).collect();
    for key in all_keys {
        if whitelist.is_header_whitelisted(key, &req1.url) {
            whitelisted_keys.push(key.to_lowercase());
        }
    }

    ComparisonSection {
        content1,
        content2,
        differences: vec![],
        whitelisted_keys,
    }
}

fn create_payloads_section(req1: &HarRequest, req2: &HarRequest, whitelist: &WhitelistConfig) -> Option<ComparisonSection> {
    // Only create payloads section if at least one request has a payload
    if req1.post_data.is_some() || req2.post_data.is_some() {
        let content1 = req1.post_data.as_ref().map_or("No payload".to_string(), |body| {
            if body.trim().is_empty() {
                "Empty payload".to_string()
            } else {
                format_json_string(body)
            }
        });

        let content2 = req2.post_data.as_ref().map_or("No payload".to_string(), |body| {
            if body.trim().is_empty() {
                "Empty payload".to_string()
            } else {
                format_json_string(body)
            }
        });

        // Collect whitelisted payload keys
        let mut whitelisted_keys = Vec::new();
        if let (Some(data1), Some(data2)) = (&req1.post_data, &req2.post_data) {
            if let (Ok(json1), Ok(json2)) = (
                serde_json::from_str::<serde_json::Value>(data1),
                serde_json::from_str::<serde_json::Value>(data2),
            ) {
                collect_whitelisted_json_keys(&json1, &json2, &req1.url, whitelist, &mut whitelisted_keys);
            }
        }

        Some(ComparisonSection {
            content1,
            content2,
            differences: vec![],
            whitelisted_keys,
        })
    } else {
        None
    }
}

fn collect_whitelisted_json_keys(
    val1: &serde_json::Value,
    val2: &serde_json::Value,
    url: &str,
    whitelist: &WhitelistConfig,
    result: &mut Vec<String>,
) {
    if let (serde_json::Value::Object(obj1), serde_json::Value::Object(obj2)) = (val1, val2) {
        let all_keys: HashSet<&String> = obj1.keys().chain(obj2.keys()).collect();
        for key in all_keys {
            if whitelist.is_payload_key_whitelisted(key, url) {
                result.push(key.to_lowercase());
            }
        }
    }
}

fn format_raw_request(req: &HarRequest) -> String {
    let mut raw_request = String::new();

    // Request line
    let query_string = if req.query_params.is_empty() {
        String::new()
    } else {
        let params: Vec<String> = req.query_params.iter()
            .flat_map(|(key, values)| {
                values.iter().map(move |value| {
                    format!("{}={}",
                        urlencoding::encode(key),
                        urlencoding::encode(value)
                    )
                })
            })
            .collect();
        if params.is_empty() {
            String::new()
        } else {
            format!("?{}", params.join("&"))
        }
    };

    raw_request.push_str(&format!("{} {}{} HTTP/1.1\n", req.method, req.path, query_string));

    // Headers (sorted alphabetically)
    let mut headers: Vec<_> = req.headers.iter().collect();
    headers.sort_by_key(|(key, _)| key.to_lowercase());

    for (key, value) in headers {
        raw_request.push_str(&format!("{}: {}\n", key, value));
    }

    // Empty line between headers and body
    raw_request.push('\n');

    // Body (if present)
    if let Some(body) = &req.post_data {
        if !body.is_empty() {
            // Try to format as JSON with sorted keys and 4-space indentation
            let formatted_body = format_json_string(body);
            raw_request.push_str(&formatted_body);
        }
    }

    raw_request
}

fn format_headers(headers: &HashMap<String, String>) -> String {
    if headers.is_empty() {
        "No headers".to_string()
    } else {
        let mut lines: Vec<String> = headers.iter()
            .map(|(k, v)| format!("{}: {}", k, v))
            .collect();
        lines.sort();
        lines.join("\n")
    }
}

fn format_params(params: &HashMap<String, Vec<String>>) -> String {
    if params.is_empty() {
        "No parameters".to_string()
    } else {
        let mut lines: Vec<String> = params.iter()
            .map(|(k, v)| format!("{}: {}", k, v.join(", ")))
            .collect();
        lines.sort();
        lines.join("\n")
    }
}

fn format_json_string(json_str: &str) -> String {
    match serde_json::from_str::<serde_json::Value>(json_str) {
        Ok(parsed) => {
            // Sort keys alphabetically and format with 4-space indentation
            let sorted_json = sort_json_keys(&parsed);
            serde_json::to_string_pretty(&sorted_json).unwrap_or_else(|_| json_str.to_string())
        },
        Err(_) => json_str.to_string(),
    }
}

fn sort_json_keys(value: &serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let mut sorted_map = serde_json::Map::new();
            let mut keys: Vec<_> = map.keys().collect();
            keys.sort();

            for key in keys {
                if let Some(val) = map.get(key) {
                    sorted_map.insert(key.clone(), sort_json_keys(val));
                }
            }
            serde_json::Value::Object(sorted_map)
        },
        serde_json::Value::Array(arr) => {
            serde_json::Value::Array(arr.iter().map(sort_json_keys).collect())
        },
        _ => value.clone(),
    }
}

fn create_response_body_section(req1: &HarRequest, req2: &HarRequest, whitelist: &WhitelistConfig) -> Option<ComparisonSection> {
    if req1.response_body.is_some() || req2.response_body.is_some() {
        let content1 = req1.response_body.as_ref().map_or("No response body".to_string(), |body| {
            format_json_string(body)
        });
        let content2 = req2.response_body.as_ref().map_or("No response body".to_string(), |body| {
            format_json_string(body)
        });

        // Collect whitelisted payload keys from response body
        let mut whitelisted_keys = Vec::new();
        if let (Some(body1), Some(body2)) = (&req1.response_body, &req2.response_body) {
            if let (Ok(json1), Ok(json2)) = (
                serde_json::from_str::<serde_json::Value>(body1),
                serde_json::from_str::<serde_json::Value>(body2),
            ) {
                collect_whitelisted_json_keys(&json1, &json2, &req1.url, whitelist, &mut whitelisted_keys);
            }
        }

        Some(ComparisonSection {
            content1,
            content2,
            differences: vec![],
            whitelisted_keys,
        })
    } else {
        None
    }
}
