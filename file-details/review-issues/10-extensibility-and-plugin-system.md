# Issue 10: Plugin System Extensibility and Registry Robustness

## Severity: LOW-MEDIUM

## Problem
1. `AnalyzerRegistry` has no thread safety for concurrent registration
2. No validation that `analyzer_type` is unique during registration
3. Analyzer type strings ("git", "deps", "semantic") hardcoded in `registry.get_git_api()` etc.
4. No validation of API object contract before registration
5. Plugin descriptions hardcoded in `analyzers.py` router instead of plugin metadata

## Expected Behavior
- Registry is thread-safe
- Duplicate registration raises clear error
- Plugin metadata (name, description, version, capabilities) defined on the plugin itself
- Type-safe retrieval without hardcoded strings

## Value
Third-party analyzers can be added without modifying platform code. Registry is robust under concurrent startup.

## Concerned Files

| File | Issue |
|------|-------|
| `src/platform/code_intel/registry.py` | No thread lock, no duplicate check, hardcoded type strings |
| `src/platform/code_intel/routers/analyzers.py` | Lines 58-63: hardcoded description dict |
| `src/code-intel-interfaces/code_intel_interfaces/analyzer.py` | `BaseAnalyzer` lacks `description`, `version`, `capabilities` fields |

## Suggested Changes

### 1. Add thread lock and duplicate check to registry
```python
import threading

class AnalyzerRegistry:
    _lock = threading.Lock()
    
    def register(self, analyzer):
        with self._lock:
            if analyzer.analyzer_type in self._analyzers:
                raise ValueError(f"Duplicate analyzer: {analyzer.analyzer_type}")
            self._analyzers[analyzer.analyzer_type] = analyzer
```

### 2. Add metadata to BaseAnalyzer
```python
class BaseAnalyzer(ABC):
    @property
    @abstractmethod
    def description(self) -> str: ...
    
    @property
    def version(self) -> str:
        return "0.0.0"
    
    @property
    def capabilities(self) -> list[str]:
        return []
```

### 3. Read descriptions from plugin metadata in `analyzers.py` router
```python
info["description"] = analyzer.description
info["version"] = analyzer.version
```
