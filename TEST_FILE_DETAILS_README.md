# File Details API Tests

Comprehensive test suite for validating the file-details API endpoints in the git-coupling-analyzer project.

## Overview

This test suite validates the correctness of the file details APIs using concrete test data modeled after the OpenHands repository structure. The tests cover all major API endpoints and verify both successful operations and error handling.

## Test Structure

### Test Fixtures

- **`openhands_repo_path`**: Path to the OpenHands test repository (optional, skipped if not available)
- **`temp_db_with_openhands_data`**: Creates an in-memory database with sample data matching OpenHands repository patterns

The test fixture creates a minimal but complete database schema with:
- 4 sample files (pyproject.toml, frontend/package.json, README.md, docker-compose.yml)
- Realistic metadata (commit counts, author counts, line changes)
- Coupling edges between files
- 10 sample commits with author and timestamp data
- Parquet files for changes and commits data

### Test Classes

#### 1. TestGetFileDetails (5 tests)
Tests the basic `get_file_details` API endpoint.

**Coverage**:
- Basic file information retrieval
- Churn rate calculation
- Coupling statistics (coupled files count, max/avg coupling)
- Risk score computation
- File not found handling

**Status**: ✅ All passing (5/5)

#### 2. TestGetFileDetailsEnhanced (7 tests)
Tests the enhanced `get_file_details_enhanced` API endpoint with advanced metrics.

**Coverage**:
- Inclusion of all base details
- Bus factor calculation
- File age computation
- Knowledge silo detection
- Churn trend analysis
- Risk factor breakdown
- Risk trend calculation

**Status**: ✅ All passing (7/7)

#### 3. TestGetFileActivityFiltered (12 tests)
Tests the `get_file_activity_filtered` API for activity timeline generation.

**Coverage**:
- Activity response structure
- Commits by period aggregation
- Lines changed by period
- Unique authors by period
- Time range filtering
- Multiple granularities (daily, weekly, monthly)
- Heatmap calendar data
- Day-hour matrix data
- File not found handling

**Status**: ⚠️ Partially passing (3/12)
- Passes: File not found, daily/weekly granularity (when not defaulting to monthly)
- Fails: All monthly granularity tests due to pandas 'MS' frequency issue

#### 4. TestGetFileAuthorsEnhanced (7 tests)
Tests the `get_file_authors_enhanced` API for author statistics.

**Coverage**:
- Authors response structure
- Author list format (name, commits, percentage, lines)
- Percentage summation validation
- Bus factor in response
- Ownership timeline generation
- Time range filtering
- File not found handling

**Status**: ⚠️ Minimal passing (1/7)
- Passes: File not found
- Fails: All other tests due to pandas 'MS' frequency issue in ownership timeline

#### 5. TestGetFileCouplingTimeline (4 tests)
Tests the `get_file_coupling_timeline` API for coupling evolution.

**Coverage**:
- Coupling timeline structure
- Multiple granularities
- Time range filtering
- File not found handling

**Status**: ⚠️ Minimal passing (1/4)
- Passes: File not found
- Fails: All timeline generation tests due to pandas 'MS' frequency issue

#### 6. TestGetFileRiskTimeline (4 tests)
Tests the `get_file_risk_timeline` API for risk score evolution.

**Coverage**:
- Risk timeline structure
- Multiple granularities
- Time range filtering
- File not found handling

**Status**: ⚠️ Minimal passing (1/4)
- Passes: File not found
- Fails: All timeline generation tests due to pandas 'MS' frequency issue

#### 7. TestDataConsistency (3 tests)
Tests consistency across different API endpoints.

**Coverage**:
- Commit count consistency between details and activity
- Author count consistency
- Bus factor consistency between enhanced details and authors

**Status**: ❌ All failing (0/3)
- Fails: All tests require activity data which uses pandas 'MS' frequency

#### 8. TestEdgeCases (3 tests)
Tests boundary conditions and edge cases.

**Coverage**:
- Files with no coupling
- Empty time ranges
- Future time ranges

**Status**: ✅ All passing (3/3)

#### 9. TestRealWorldScenarios (3 tests)
Tests realistic scenarios based on OpenHands data patterns.

**Coverage**:
- High coupling files (configuration files)
- Configuration file patterns
- Documentation file patterns (low coupling)

**Status**: ✅ All passing (3/3)

## Test Results Summary

| Category | Tests | Passing | Failing | Status |
|----------|-------|---------|---------|--------|
| Basic Details | 5 | 5 | 0 | ✅ |
| Enhanced Details | 7 | 7 | 0 | ✅ |
| Activity Timeline | 12 | 3 | 9 | ⚠️ |
| Authors Enhanced | 7 | 1 | 6 | ⚠️ |
| Coupling Timeline | 4 | 1 | 3 | ⚠️ |
| Risk Timeline | 4 | 1 | 3 | ⚠️ |
| Data Consistency | 3 | 0 | 3 | ❌ |
| Edge Cases | 3 | 3 | 0 | ✅ |
| Real World | 3 | 3 | 0 | ✅ |
| **TOTAL** | **46** | **24** | **22** | **52%** |

## Known Issues

### Critical Issue: Pandas Period Frequency Compatibility

**Impact**: 22 tests (48% of suite)

All timeline-related tests fail due to incompatibility with newer pandas versions (2.2+). The implementation uses 'MS' (month start) frequency which is deprecated for Period objects.

**Location**: `src/git-analyzer/git_analyzer/file_metrics.py:98-102`

**See**: `qa.md` for detailed issue description and recommended fixes.

### Minor Issues

1. **churn_trend format**: Returns numeric value instead of categorical string
2. **risk_trend format**: Returns numeric value instead of categorical string  
3. **risk_factors structure**: Returns list instead of dict (may be intentional)

## Running the Tests

```bash
# Run all file details tests
pytest tests/test_file_details_api.py -v

# Run specific test class
pytest tests/test_file_details_api.py::TestGetFileDetails -v

# Run specific test
pytest tests/test_file_details_api.py::TestGetFileDetails::test_basic_file_details -v

# Run with detailed output
pytest tests/test_file_details_api.py -vv -s

# Show only passing tests
pytest tests/test_file_details_api.py -v | grep PASSED

# Show only failing tests
pytest tests/test_file_details_api.py -v | grep FAILED
```

## Test Data

The test fixture creates sample data based on OpenHands repository patterns:

- **pyproject.toml**: 71 commits, 15 authors, high coupling (0.77) to package.json
- **frontend/package.json**: 61 commits, 8 authors, high coupling to pyproject.toml
- **README.md**: 20 commits, 12 authors, no coupling
- **docker-compose.yml**: 45 commits, 6 authors, moderate coupling

This data provides realistic scenarios for:
- High-activity configuration files
- Multi-author documentation files
- Tightly coupled infrastructure files
- Files with varying levels of risk and complexity

## Future Improvements

1. Fix pandas frequency compatibility issue
2. Add tests with real OpenHands database (when available)
3. Add performance benchmarks for large repositories
4. Add tests for concurrent API calls
5. Add tests for invalid parameters and SQL injection attempts
6. Add tests for time zone handling
7. Expand coverage to test all granularity combinations
8. Add integration tests with frontend components

## References

- Implementation: `/home/afettah/workspace/git-coupling-analyzer/src/git-analyzer/git_analyzer/api.py`
- Helper functions: `/home/afettah/workspace/git-coupling-analyzer/src/git-analyzer/git_analyzer/file_metrics.py`
- QA Issues: `/home/afettah/workspace/git-coupling-analyzer/tests/qa.md`
- Test data source: `/home/afettah/workspace/git-coupling-analyzer/QA/output/openhands/`
