# Issue: Spectral clustering returns 500 Internal Server Error

**Severity:** High  
**Date:** 2026-02-07  
**Status:** Open  
**Component:** Clustering - Spectral Algorithm

## Description

Running spectral clustering via the API always returns a 500 Internal Server Error.

## Reproduction

```bash
curl -s -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "spectral", "min_weight": 0.1}'
```

## Response

```json
{"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred", "details": null}}
```

## Expected

Either a successful clustering result or a meaningful error (e.g., 400 with "not enough connected components").

## Notes

All other algorithms (louvain, hierarchical, dbscan, label_propagation) return results without 500 errors.
