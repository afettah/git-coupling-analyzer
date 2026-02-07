# Issue: Invalid clustering algorithm returns 500 instead of 400/422

**Severity:** Low  
**Date:** 2026-02-07  
**Status:** Open  
**Component:** API - Clustering Error Handling

## Description

Passing an invalid algorithm name to the clustering endpoint returns a 500 Internal Server Error instead of a proper validation error.

## Reproduction

```bash
curl -s -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "invalid_algo"}'
```

## Response

```json
{"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred", "details": null}}
```

## Expected

400 or 422 with a message like:
```json
{"error": {"code": "VALIDATION_ERROR", "message": "Unknown algorithm: invalid_algo. Available: louvain, hierarchical, spectral, dbscan, label_propagation"}}
```
