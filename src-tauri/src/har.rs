use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
    pub status: String, // "match", "partial", "different"
    pub details: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AlignedPair {
    pub index1: Option<usize>,
    pub index2: Option<usize>,
    pub comparison: Option<ComparisonResult>,
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
        match HarRequest::from_raw_entry(entry, index) {
            Ok(request) => requests.push(request),
            Err(e) => {
                eprintln!("Warning: Failed to parse entry {}: {}", index, e);
                // Continue parsing other entries
            }
        }
    }

    Ok(requests)
}

pub fn compare_requests(req1: &HarRequest, req2: &HarRequest, keys_only: bool) -> ComparisonResult {
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

    if keys_only {
        // Compare only keys
        let headers_match = req1.headers.keys().collect::<std::collections::HashSet<_>>()
            == req2.headers.keys().collect::<std::collections::HashSet<_>>();

        // For GET requests, don't compare query params in matching
        let params_match = if req1.method.to_uppercase() == "GET" {
            true // Always consider params as matching for GET requests
        } else {
            req1.query_params.keys().collect::<std::collections::HashSet<_>>()
                == req2.query_params.keys().collect::<std::collections::HashSet<_>>()
        };

        if headers_match && params_match {
            ComparisonResult {
                status: "match".to_string(),
                details: "Keys match".to_string(),
            }
        } else {
            ComparisonResult {
                status: "partial".to_string(),
                details: "Keys differ".to_string(),
            }
        }
    } else {
        // Full comparison
        // For GET requests, don't compare query params in matching
        let params_match = if req1.method.to_uppercase() == "GET" {
            true // Always consider params as matching for GET requests
        } else {
            req1.query_params == req2.query_params
        };

        if req1.method == req2.method
            && params_match
            && req1.headers == req2.headers
            && req1.post_data == req2.post_data
        {
            ComparisonResult {
                status: "match".to_string(),
                details: "Full match".to_string(),
            }
        } else {
            ComparisonResult {
                status: "partial".to_string(),
                details: "Partial match".to_string(),
            }
        }
    }
}

pub fn align_requests(requests1: &[HarRequest], requests2: &[HarRequest]) -> Vec<AlignedPair> {
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
                    comparison: Some(compare_requests(req1, req2, false)),
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

    // Add remaining requests from requests2
    for (j, _) in requests2.iter().enumerate() {
        if !used2[j] {
            aligned.push(AlignedPair {
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

    // Create path sequences for comparison
    let paths1: Vec<&str> = requests1.iter().map(|r| r.path.as_str()).collect();
    let paths2: Vec<&str> = requests2.iter().map(|r| r.path.as_str()).collect();

    // Simple LCS-based alignment
    let mut aligned = Vec::new();
    let mut i = 0;
    let mut j = 0;

    while i < paths1.len() || j < paths2.len() {
        if i < paths1.len() && j < paths2.len() && paths1[i] == paths2[j] {
            // Match found
            let comparison = Some(compare_requests(&requests1[i], &requests2[j], false));
            aligned.push(AlignedPair {
                index1: Some(i),
                index2: Some(j),
                comparison,
            });
            i += 1;
            j += 1;
        } else if i < paths1.len() && (j >= paths2.len() || !paths2[j..].contains(&paths1[i])) {
            // Item only in first list
            aligned.push(AlignedPair {
                index1: Some(i),
                index2: None,
                comparison: None,
            });
            i += 1;
        } else if j < paths2.len() {
            // Item only in second list
            aligned.push(AlignedPair {
                index1: None,
                index2: Some(j),
                comparison: None,
            });
            j += 1;
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
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiffLine {
    pub line_number: usize,
    pub diff_type: String, // "same", "different", "missing"
    pub content: String,
}

pub fn create_detailed_comparison(req1: &HarRequest, req2: &HarRequest, keys_only: bool) -> DetailedComparison {
    DetailedComparison {
        general: create_general_section(req1, req2),
        raw_request: create_raw_request_section(req1, req2),
        headers: create_headers_section(req1, req2, keys_only),
        payloads: create_payloads_section(req1, req2),
        params: create_params_section(req1, req2, keys_only),
        response: create_response_section(req1, req2, keys_only),
        response_body: create_response_body_section(req1, req2),
    }
}

fn create_general_section(req1: &HarRequest, req2: &HarRequest) -> ComparisonSection {
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
        differences: vec![], // React library handles diffing
    }
}

fn create_headers_section(req1: &HarRequest, req2: &HarRequest, _keys_only: bool) -> ComparisonSection {
    let content1 = format_headers(&req1.headers);
    let content2 = format_headers(&req2.headers);

    ComparisonSection {
        content1,
        content2,
        differences: vec![], // React library handles diffing
    }
}

fn create_params_section(req1: &HarRequest, req2: &HarRequest, _keys_only: bool) -> ComparisonSection {
    let content1 = format_params(&req1.query_params);
    let content2 = format_params(&req2.query_params);

    ComparisonSection {
        content1,
        content2,
        differences: vec![], // React library handles diffing
    }
}

fn create_body_section(req1: &HarRequest, req2: &HarRequest) -> Option<ComparisonSection> {
    if req1.post_data.is_some() || req2.post_data.is_some() {
        let content1 = req1.post_data.as_ref().map_or("No body".to_string(), |body| {
            format_json_string(body)
        });
        let content2 = req2.post_data.as_ref().map_or("No body".to_string(), |body| {
            format_json_string(body)
        });

        Some(ComparisonSection {
            content1,
            content2,
            differences: vec![], // React library handles diffing
        })
    } else {
        None
    }
}

fn create_response_section(req1: &HarRequest, req2: &HarRequest, _keys_only: bool) -> ComparisonSection {
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

    ComparisonSection {
        content1,
        content2,
        differences: vec![], // React library handles diffing
    }
}

fn create_raw_request_section(req1: &HarRequest, req2: &HarRequest) -> ComparisonSection {
    let content1 = format_raw_request(req1);
    let content2 = format_raw_request(req2);

    ComparisonSection {
        content1,
        content2,
        differences: vec![], // React library handles diffing
    }
}

fn create_payloads_section(req1: &HarRequest, req2: &HarRequest) -> Option<ComparisonSection> {
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

        Some(ComparisonSection {
            content1,
            content2,
            differences: vec![], // React library handles diffing
        })
    } else {
        None
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

fn create_response_body_section(req1: &HarRequest, req2: &HarRequest) -> Option<ComparisonSection> {
    if req1.response_body.is_some() || req2.response_body.is_some() {
        let content1 = req1.response_body.as_ref().map_or("No response body".to_string(), |body| {
            format_json_string(body)
        });
        let content2 = req2.response_body.as_ref().map_or("No response body".to_string(), |body| {
            format_json_string(body)
        });

        Some(ComparisonSection {
            content1,
            content2,
            differences: vec![], // React library handles diffing
        })
    } else {
        None
    }
}
