# Edge Cases and Error Handling Test Report

**Date:** 2025-01-27  
**Repository:** openhands  
**API Base:** http://localhost:8000

## Summary

| Category | Tests | Pass | Fail | Issues Found |
|----------|-------|------|------|--------------|
| Non-existent resources | 4 | 3 | 1 | 1 |
| Invalid parameters | 5 | 3 | 2 | 2 |
| Boundary conditions | 5 | 4 | 1 | 1 |
| Malformed requests | 3 | 2 | 1 | 1 |
| Data consistency | 2 | 2 | 0 | 0 |

**Overall:** 5 issues found

---

## 1. Non-existent Resources

### ✅ PASS: File details for non-existent path
```bash
GET /repos/openhands/files/path/that/does/not/exist/details
# Response: 404 with proper error format
{"error":{"code":"HTTP_404","message":"File not found: path/that/does/not/exist","details":null}}
```

### ✅ PASS: Coupling for non-existent file
```bash
GET /repos/openhands/coupling?path=nonexistent.py
# Response: 404 with proper error format
{"error":{"code":"HTTP_404","message":"File not found: nonexistent.py","details":null}}
```

### ✅ PASS: Non-existent clustering snapshot
```bash
GET /repos/openhands/clustering/snapshots/nonexistent
# Response: 404 with proper error format
{"error":{"code":"HTTP_404","message":"Snapshot not found","details":null}}
```

### ❌ FAIL: Non-existent repository returns empty array instead of 404
```bash
GET /repos/nonexistent_repo/files
# Response: 200 with []
# Expected: 404 {"error":{"code":"HTTP_404","message":"Repository not found","details":null}}
```

**Issue EDGE-001:** Non-existent repository should return 404, not empty array.

---

## 2. Invalid Parameters

### ✅ PASS: Invalid sort_by parameter
```bash
GET /repos/openhands/files?sort_by=invalid
# Response: 400
{"error":{"code":"HTTP_400","message":"sort_by must be 'path' or 'commits'","details":null}}
```

### ❌ FAIL: Negative limit accepted, returns all data
```bash
GET /repos/openhands/files?limit=-1
# Response: 200 with data (returns all files)
# Expected: 400/422 validation error for negative limit
```

**Issue EDGE-002:** Negative `limit` parameter should return 400/422 validation error.

### ✅ PASS: Very large limit handled gracefully
```bash
GET /repos/openhands/files?limit=999999
# Response: 200 with 451 files (all available)
# Behavior: Returns actual file count, doesn't error
```

### ❌ FAIL: Invalid algorithm returns 422 but with misleading response body
```bash
POST /repos/openhands/clustering/run
{"algorithm": "invalid", "folders": ["openhands/"]}
# Response: 422 with actual cluster data!
{"algorithm":"invalid","cluster_count":0,"clusters":[],"metrics":{}}
# Expected: 422 with error message listing valid algorithms
```

**Issue EDGE-003:** Invalid clustering algorithm should return a clear error message, not empty results.

### ✅ PASS: min_jaccard out of range (requires path parameter first)
```bash
GET /repos/openhands/coupling?min_jaccard=2.0
# Response: 422 - validates path is required first
{"error":{"code":"VALIDATION_ERROR","message":"Validation error","details":[{"type":"missing","loc":["query","path"],"msg":"Field required","input":null}]}}
```

---

## 3. Boundary Conditions

### ✅ PASS: limit=0 returns empty array
```bash
GET /repos/openhands/files?limit=0
# Response: 200 []
```

### ✅ PASS: depth=0 returns top-level only
```bash
GET /repos/openhands/folders?depth=0
# Response: 200 with 1 entry (root level)
```

### ✅ PASS: depth=100 (extreme) handled gracefully
```bash
GET /repos/openhands/folders?depth=100
# Response: 200 with 0 results (no folders at that depth)
```

### ❌ FAIL: Empty folders array runs clustering on entire repo
```bash
POST /repos/openhands/clustering/run
{"algorithm": "louvain", "folders": []}
# Response: 422 status but returns full clustering results!
{"algorithm":"louvain","cluster_count":444,"clusters":[...]}
# Expected: 422 with validation error "folders cannot be empty"
```

**Issue EDGE-004:** Empty `folders` array should validate and return error, not run full clustering.

### ✅ PASS: Special characters in path handled correctly
```bash
GET /repos/openhands/coupling?path=test%20file%26special%3Dchars.py
# Response: 404 (file not found, but URL decoding works)
{"error":{"code":"HTTP_404","message":"File not found: test file&special=chars.py","details":null}}
```

---

## 4. Malformed Requests

### ✅ PASS: Invalid JSON returns clear error
```bash
POST /repos/openhands/analysis/start
Body: invalid json {
# Response: 422
{"error":{"code":"VALIDATION_ERROR","message":"Validation error","details":[{"type":"json_invalid","loc":["body",0],"msg":"JSON decode error","input":{},"ctx":{"error":"Expecting value"}}]}}
```

### ❌ FAIL: Missing required fields defaults instead of erroring
```bash
POST /repos/openhands/clustering/run
Body: {}
# Response: 200 with full clustering results using defaults
{"algorithm":"louvain","cluster_count":444,"clusters":[...]}
# Expected: 422 validation error for missing required fields
```

**Issue EDGE-005:** Missing required fields in clustering request should return validation error, not use defaults.

### ⚠️ INCONSISTENT: Missing folders field
```bash
POST /repos/openhands/clustering/run
Body: {"algorithm": "louvain"}
# Response: 422 status but includes full clustering data
# Mixed signal - HTTP status says error but body has valid results
```

---

## 5. Data Consistency

### ✅ PASS: File ID format consistent
- File IDs are integers across all endpoints
- IDs returned from `/files` can be used in other endpoints

### ✅ PASS: Non-existent snapshot edges return 404
```bash
GET /repos/openhands/clustering/snapshots/nonexistent/edges
# Response: 404
{"error":{"code":"HTTP_404","message":"Snapshot not found","details":null}}
```

---

## Issues Summary

| ID | Severity | Description |
|----|----------|-------------|
| EDGE-001 | Medium | Non-existent repo returns 200 [] instead of 404 |
| EDGE-002 | Low | Negative limit parameter accepted |
| EDGE-003 | Medium | Invalid algorithm returns empty results instead of error |
| EDGE-004 | High | Empty folders array runs full clustering |
| EDGE-005 | Medium | Empty request body uses defaults without validation |

---

## Recommendations

1. **Repository validation:** Add middleware to validate repo_id exists before processing requests
2. **Parameter validation:** Add Pydantic validators for:
   - `limit >= 0` or `limit >= 1`
   - Algorithm name in allowed set
   - Non-empty folders array when required
3. **Consistent error responses:** Ensure 422 responses never include successful data payloads
4. **Default behavior documentation:** If defaults are intentional, document them clearly

---

## Test Commands Reference

```bash
# Non-existent resources
curl http://localhost:8000/repos/nonexistent_repo/files
curl http://localhost:8000/repos/openhands/files/invalid/path/details
curl "http://localhost:8000/repos/openhands/coupling?path=nonexistent.py"
curl http://localhost:8000/repos/openhands/clustering/snapshots/nonexistent

# Invalid parameters
curl "http://localhost:8000/repos/openhands/files?sort_by=invalid"
curl "http://localhost:8000/repos/openhands/files?limit=-1"
curl -X POST http://localhost:8000/repos/openhands/clustering/run \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "invalid", "folders": ["openhands/"]}'

# Boundary conditions  
curl "http://localhost:8000/repos/openhands/files?limit=0"
curl -X POST http://localhost:8000/repos/openhands/clustering/run \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "louvain", "folders": []}'

# Malformed requests
curl -X POST http://localhost:8000/repos/openhands/analysis/start \
  -H "Content-Type: application/json" \
  -d 'invalid json {'
```
