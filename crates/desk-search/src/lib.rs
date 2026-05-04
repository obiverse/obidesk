use wasm_bindgen::prelude::*;

/// A business record for indexing.
struct Business {
    slug: String,
    tokens: Vec<String>, // all searchable text, lowercased, split into words
    name_tokens: Vec<String>, // name words (weighted 3x)
    tagline_tokens: Vec<String>, // tagline words (weighted 2x)
    category_ids: Vec<String>,
    area_id: String,
}

#[wasm_bindgen]
pub struct DeskSearch {
    businesses: Vec<Business>,
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() >= 2)
        .map(String::from)
        .collect()
}

fn levenshtein(a: &str, b: &str) -> usize {
    let (m, n) = (a.len(), b.len());
    if m == 0 { return n; }
    if n == 0 { return m; }
    let mut prev: Vec<usize> = (0..=n).collect();
    let mut curr = vec![0; n + 1];
    for (i, ca) in a.chars().enumerate() {
        curr[0] = i + 1;
        for (j, cb) in b.chars().enumerate() {
            let cost = if ca == cb { 0 } else { 1 };
            curr[j + 1] = (prev[j] + cost)
                .min(prev[j + 1] + 1)
                .min(curr[j] + 1);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[n]
}

fn fuzzy_match(query_token: &str, doc_token: &str) -> bool {
    if doc_token.starts_with(query_token) {
        return true;
    }
    let max_dist = if query_token.len() <= 3 { 0 } else if query_token.len() <= 5 { 1 } else { 2 };
    levenshtein(query_token, doc_token) <= max_dist
}

fn score_business(biz: &Business, query_tokens: &[String]) -> f64 {
    let mut score = 0.0;
    for qt in query_tokens {
        // Name match: 3x weight
        for nt in &biz.name_tokens {
            if fuzzy_match(qt, nt) {
                score += 3.0;
                break;
            }
        }
        // Tagline match: 2x weight
        for tt in &biz.tagline_tokens {
            if fuzzy_match(qt, tt) {
                score += 2.0;
                break;
            }
        }
        // Any field match: 1x weight
        for t in &biz.tokens {
            if fuzzy_match(qt, t) {
                score += 1.0;
                break;
            }
        }
    }
    score
}

#[wasm_bindgen]
impl DeskSearch {
    /// Load businesses from JSON array.
    /// Each object needs: slug, name, tagline, description, services[], tags[], categoryIds[], areaId
    #[wasm_bindgen(constructor)]
    pub fn new(json: &str) -> Result<DeskSearch, JsValue> {
        let parsed: Vec<serde_json::Value> = serde_json::from_str(json)
            .map_err(|e| JsValue::from_str(&format!("JSON parse error: {}", e)))?;

        let mut businesses = Vec::with_capacity(parsed.len());
        for obj in &parsed {
            let slug = obj["slug"].as_str().unwrap_or("").to_string();
            let name = obj["name"].as_str().unwrap_or("");
            let tagline = obj["tagline"].as_str().unwrap_or("");
            let description = obj["description"].as_str().unwrap_or("");

            let services: Vec<&str> = obj["services"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str()).collect())
                .unwrap_or_default();
            let tags: Vec<&str> = obj["tags"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str()).collect())
                .unwrap_or_default();
            let category_ids: Vec<String> = obj["categoryIds"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let area_id = obj["areaId"].as_str().unwrap_or("").to_string();

            let all_text = format!(
                "{} {} {} {} {}",
                name, tagline, description,
                services.join(" "), tags.join(" ")
            );

            businesses.push(Business {
                slug,
                tokens: tokenize(&all_text),
                name_tokens: tokenize(name),
                tagline_tokens: tokenize(tagline),
                category_ids,
                area_id,
            });
        }

        Ok(DeskSearch { businesses })
    }

    /// Search businesses. Returns JSON: [{"slug":"...","score":1.5}, ...]
    pub fn search(&self, query: &str, category: &str, area: &str, limit: u32) -> String {
        let query_tokens = tokenize(query);

        let mut results: Vec<(&str, f64)> = self.businesses.iter()
            .filter(|biz| {
                if !category.is_empty() && !biz.category_ids.iter().any(|c| c == category) {
                    return false;
                }
                if !area.is_empty() && biz.area_id != area {
                    return false;
                }
                true
            })
            .filter_map(|biz| {
                if query_tokens.is_empty() {
                    return Some((&*biz.slug, 0.0));
                }
                let s = score_business(biz, &query_tokens);
                if s > 0.0 { Some((&*biz.slug, s)) } else { None }
            })
            .collect();

        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(limit as usize);

        // Manual JSON serialization (no serde needed for output)
        let entries: Vec<String> = results.iter()
            .map(|(slug, score)| format!(r#"{{"slug":"{}","score":{:.1}}}"#, slug, score))
            .collect();
        format!("[{}]", entries.join(","))
    }

    pub fn count(&self) -> u32 {
        self.businesses.len() as u32
    }
}

#[wasm_bindgen]
pub fn ping() -> String {
    "desk-search ready".into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ping() {
        assert_eq!(ping(), "desk-search ready");
    }

    #[test]
    fn test_tokenize() {
        let tokens = tokenize("Hello World, AC Repair!");
        assert_eq!(tokens, vec!["hello", "world", "ac", "repair"]);
    }

    #[test]
    fn test_levenshtein() {
        assert_eq!(levenshtein("kitten", "sitting"), 3);
        assert_eq!(levenshtein("", "abc"), 3);
        assert_eq!(levenshtein("abc", "abc"), 0);
    }

    #[test]
    fn test_fuzzy_match() {
        assert!(fuzzy_match("school", "schools")); // prefix
        assert!(fuzzy_match("repair", "repiar")); // 1 edit, len=6
        assert!(!fuzzy_match("ac", "zz")); // len<=3, 0 edits allowed
        assert!(fuzzy_match("ac", "ac")); // exact
    }

    #[test]
    fn test_search() {
        let json = r#"[
            {"slug":"test-school","name":"Test School","tagline":"Education","description":"A school","services":["Teaching"],"tags":["school"],"categoryIds":["schools"],"areaId":"gwarinpa"},
            {"slug":"test-clinic","name":"Test Clinic","tagline":"Health","description":"A clinic","services":["Consulting"],"tags":["health"],"categoryIds":["clinics"],"areaId":"wuse"}
        ]"#;
        let ds = DeskSearch::new(json).unwrap();
        assert_eq!(ds.count(), 2);

        let results = ds.search("school", "", "", 10);
        assert!(results.contains("test-school"));
        assert!(!results.contains("test-clinic"));

        // Category filter
        let results = ds.search("", "clinics", "", 10);
        assert!(results.contains("test-clinic"));
        assert!(!results.contains("test-school"));

        // Area filter
        let results = ds.search("", "", "gwarinpa", 10);
        assert!(results.contains("test-school"));
    }
}
