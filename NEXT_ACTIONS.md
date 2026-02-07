
## ⚡ Quick Wins (High Value, Low Effort)

### 5. Add Lines Added/Deleted to Git Log Extraction
**Impact**: Accurate line counts instead of zeros  
**Effort**: ~1 hour  
**Files**: `src/git-analyzer/git_analyzer/git.py`

Current command uses `--name-status`. Add a second pass with `--numstat`:

```python
# After name-status pass, run numstat for line counts
numstat_args = ["git", "-C", str(repo_path), "log", "--numstat", "--no-merges", "-z"]
# Parse and merge with changes_data
```

**Alternative**: Use `git show --numstat` per-commit (slower but accurate)

---

### 6. Implement Clustering Snapshot Comparison
**Impact**: Track cluster drift over time  
**Effort**: ~2 hours  
**Files**: `src/platform/code_intel/routers/git.py`

Skeleton already exists at line 599. Use existing function:
```python
from git_analyzer.clustering.insights import compare_clusters

# Load two snapshots
snapshot1 = get_snapshot_result(base_id)
snapshot2 = get_snapshot_result(head_id)

# Compare
comparison = compare_clusters(snapshot1, snapshot2, file_map)
return comparison
```

---

### 7. Implement File Activity Heatmaps
**Impact**: Better visualization of commit patterns  
**Effort**: ~1 hour  
**Files**: `src/platform/code_intel/routers/git.py` line 271

```python
# Compute day-of-week × hour-of-day matrix
from datetime import datetime

day_hour = [[0]*24 for _ in range(7)]
for ch in changes:
    ts = ch["commit_ts"]
    dt = datetime.fromtimestamp(ts)
    day_hour[dt.weekday()][dt.hour] += 1

return {"day_hour_matrix": day_hour}
```

---

## 🔧 Optional Enhancements (Nice to Have)

### 8. Add Incremental Analysis
**Impact**: Faster re-analysis (only new commits)  
**Effort**: ~4 hours  
**Approach**:
1. Store last analyzed commit OID in `repo_meta`
2. Use `--since` parameter in git log
3. Merge new edges with existing edges (upsert)

---

### 9. Add Connection Pooling for Concurrent Requests
**Impact**: Better scalability under load  
**Effort**: ~2 hours  
**Approach**:
```python
# In registry or app startup
from contextvars import ContextVar

repo_storage_cache: ContextVar[dict[str, Storage]] = ContextVar('repo_storage_cache')

def get_cached_storage(repo_id: str) -> Storage:
    cache = repo_storage_cache.get({})
    if repo_id not in cache:
        cache[repo_id] = Storage(...)
        repo_storage_cache.set(cache)
    return cache[repo_id]
```

---

### 10. Add Real-time Progress Updates
**Impact**: Better UX for long-running analysis  
**Effort**: ~3 hours  
**Approach**: Use WebSockets or Server-Sent Events (SSE)

```python
@router.get("/analysis/{task_id}/stream")
async def stream_progress(task_id: str):
    async def event_generator():
        while True:
            progress = get_task_progress(task_id)
            yield f"data: {json.dumps(progress)}\n\n"
            if progress["state"] in ["completed", "failed"]:
                break
            await asyncio.sleep(1)
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

## 📊 Monitoring & Observability

### 11. Add Structured Logging
**Files to update**:
- `src/platform/code_intel/logging_utils.py`
- All API methods

```python
import structlog

logger = structlog.get_logger()
logger.info("analysis_started", repo_id=repo_id, commit_count=count)
```

---

### 12. Add Performance Metrics
```python
from time import time

def timed_operation(func):
    def wrapper(*args, **kwargs):
        start = time()
        result = func(*args, **kwargs)
        duration = time() - start
        logger.info("operation_completed", 
                   operation=func.__name__, 
                   duration_ms=duration*1000)
        return result
    return wrapper
```

---

### 13. Add Health Check Endpoints
```python
@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "data_dir": str(DEFAULT_DATA_DIR),
        "repos": len(list(DEFAULT_DATA_DIR.glob("repos/*")))
    }

@router.get("/repos/{repo_id}/health")
async def repo_health(repo_id: str):
    paths = _paths(repo_id)
    return {
        "repo_id": repo_id,
        "db_exists": paths.db_path.exists(),
        "db_size_mb": paths.db_path.stat().st_size / 1024 / 1024,
        "last_analysis": get_last_analysis_time(repo_id)
    }
```

---

## 🚀 Deployment Checklist

### Environment Setup
- [ ] Set `CODE_INTEL_DATA_DIR` environment variable
- [ ] Ensure data directory has sufficient disk space (estimate: 100MB per 1000 commits)
- [ ] Install Python dependencies: `pip install -r requirements.txt`

### Configuration
- [ ] Review `pyproject.toml` for any missing dependencies
- [ ] Set log level: `export LOG_LEVEL=INFO` (or DEBUG for troubleshooting)
- [ ] Configure CORS if frontend is on different domain

### Security
- [ ] Add authentication/authorization if exposing publicly
- [ ] Set up rate limiting (e.g., via nginx or FastAPI middleware)
- [ ] Enable HTTPS for production

### Monitoring
- [ ] Set up log aggregation (e.g., ELK, Loki)
- [ ] Add application metrics (e.g., Prometheus)
- [ ] Set up alerts for failed analyses

---

## 🧪 Testing Strategy

### Unit Tests (To Add)
```bash
# Create tests directory
mkdir -p tests/unit/git_analyzer

# Test extraction
tests/unit/git_analyzer/test_extract.py

# Test API methods
tests/unit/git_analyzer/test_api.py

# Test clustering
tests/unit/git_analyzer/test_clustering.py
```

### Integration Tests (To Add)
```bash
# Test full workflow
tests/integration/test_full_workflow.py

# Test API endpoints
tests/integration/test_api_endpoints.py
```

### Performance Tests
```bash
# Benchmark against known repos
scripts/benchmark.sh
```

---

## 📈 Success Metrics

Track these to measure platform success:

1. **Performance**
   - API response times < 100ms for 95th percentile
   - Analysis throughput: 1000 commits/minute
   - Dashboard loads in < 2 seconds

2. **Reliability**
   - 99.9% uptime
   - Zero data loss
   - Successful analysis completion rate > 95%

3. **Usage**
   - Number of repos analyzed
   - API requests per day
   - Clustering runs per week

---

## 🐛 Known Issues / Technical Debt

### Minor Issues (Non-blocking)
1. **Authors count shows 0 for some files**
   - **Cause**: Need re-extraction with new metadata
   - **Fix**: Re-run extraction (see action #1)

2. **Lines added/deleted not captured**
   - **Cause**: Git log uses `--name-status` not `--numstat`
   - **Fix**: See action #5

3. **Snapshot comparison not implemented**
   - **Status**: Stub exists, needs implementation
   - **Fix**: See action #6

### Future Improvements
1. Consider migrating to PostgreSQL for larger repos (>100k commits)
2. Add caching layer (Redis) for frequently accessed data
3. Implement background job queue for long-running analyses
4. Add data retention policies (archive old commits)

---

## 📚 Documentation

### To Create
- [ ] API Documentation (expand Swagger/OpenAPI)
- [ ] User Guide (how to analyze a repo)
- [ ] Admin Guide (deployment, maintenance)
- [ ] Architecture Diagram (system components)
- [ ] Contributing Guide (for developers)

### To Update
- [ ] README.md - Add quickstart guide
- [ ] CHANGELOG.md - Document all changes
- [ ] ARCHITECTURE.md - Update with new optimizations

---

## 🎯 Priority Order

### This Week
1. ✅ Re-extract repos (Action #1)
2. ✅ Test API endpoints (Actions #2-4)
3. ⚡ Add line count extraction (Action #5)

### Next Week
4. ⚡ Implement clustering comparison (Action #6)
5. ⚡ Add activity heatmaps (Action #7)
6. 📊 Add health checks (Action #13)

### This Month
7. 🔧 Add incremental analysis (Action #8)
8. 🧪 Write unit tests
9. 📚 Create documentation

### Future
10. 🔧 Connection pooling (Action #9)
11. 🔧 Real-time progress (Action #10)
12. 🚀 Production deployment

---

## ✅ When You Can Call It "Complete"

The platform is ready for production when:
- [x] All critical bugs fixed
- [x] Core API endpoints working
- [x] Performance optimizations in place
- [ ] At least one repo fully analyzed with new metadata
- [ ] API tests passing
- [ ] Health checks implemented
- [ ] Basic monitoring in place
- [ ] Documentation written

**Current Status**: 5/8 complete (62%) 🎯

**Estimated time to 100%**: 2-3 days of focused work

---

## 💡 Quick Commands Reference

```bash
# Re-analyze a repo
python -m git_analyzer.runner extract <repo_id>
python -m git_analyzer.runner analyze <repo_id>

# Start server
cd src/platform && uvicorn code_intel.app:app --reload

# Run tests
PYTHONPATH="src/git-analyzer:src/platform:src/code-intel-interfaces" python test_api_fixes.py

# Check database
sqlite3 data/repos/<repo_id>/code-intel.sqlite "SELECT COUNT(*) FROM git_edges;"

# View logs
tail -f data/repos/<repo_id>/logs/analysis.log
```

---

**Last Updated**: February 7, 2026  
**Next Review**: After completing actions #1-4
