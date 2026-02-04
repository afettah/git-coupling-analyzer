# MCP Chrome DevTools Test Scenarios

Reusable test scenarios for LFCA using the MCP Chrome DevTools server.

## Overview

This directory contains structured test scenarios for automated testing of the LFCA web interface using Chrome DevTools through the Model Context Protocol (MCP).

## Files

### 1. `test_mcp_scenario.py`
High-level test scenario framework with clear, readable methods.

**Features:**
- Clean separation of test steps
- Reusable scenario methods
- Random project name generation
- Multiple scenario modes (full, create-only, tree-only, delete-only)

**Usage Pattern:**
```python
# Run full scenario
python test_mcp_scenario.py full

# Create project only
python test_mcp_scenario.py create /path/to/repo my_project_name

# Navigate tree only (for existing project)
python test_mcp_scenario.py tree

# Delete specific project
python test_mcp_scenario.py delete project_name
```

### 2. `test_mcp_scenario_implementation.py`
Detailed implementation showing actual MCP command structure and workflow.

**Features:**
- Step-by-step workflow with numbered steps
- MCP command documentation
- Proper element UID tracking
- Screenshot capture at key points
- Modular scenario functions

**Key Methods:**
- `step_1_navigate_to_repos()` - Navigate to repos page
- `step_2_open_new_project_modal()` - Open creation modal
- `step_3_fill_project_form()` - Fill form with random/custom name
- `step_4_submit_project_creation()` - Submit and wait for analysis
- `step_5_verify_impact_graph()` - Verify default view
- `step_6_navigate_to_folder_tree()` - Switch to tree view
- `step_7_verify_and_explore_tree()` - Expand folders and verify
- `step_8_navigate_back_to_repos()` - Return to list
- `step_9_delete_project()` - Delete test project
- `step_10_verify_cleanup()` - Confirm deletion

## Complete Test Workflow

The full scenario tests this user journey:

```
1. Navigate to repos page
   ↓
2. Click "New Project" button
   ↓
3. Fill repository path + random project name
   ↓
4. Submit form → automatic analysis starts
   ↓
5. Verify Impact Graph view loads (default)
   ↓
6. Navigate to Folder Tree view
   ↓
7. Verify tree structure, expand folders
   ↓
8. Navigate back to repos list
   ↓
9. Delete the test project
   ↓
10. Verify project is removed
```

## MCP Commands Used

### Navigation
- `mcp_io_github_chr_navigate_page` - Navigate to URLs
- `mcp_io_github_chr_select_page` - Switch between tabs

### Inspection
- `mcp_io_github_chr_take_snapshot` - Get page accessibility tree
- `mcp_io_github_chr_take_screenshot` - Capture visual state

### Interaction
- `mcp_io_github_chr_click` - Click buttons/elements by UID
- `mcp_io_github_chr_fill` - Fill form inputs
- `mcp_io_github_chr_wait_for` - Wait for text/elements

### Dialog Handling
- `mcp_io_github_chr_handle_dialog` - Accept/dismiss confirmations

## Element UID Mapping

UIDs are discovered through snapshots. Key elements:

```yaml
Repos Page:
  - New Project Button: uid=1_4
  
Project Creation Modal:
  - Repository Path Input: uid=2_3
  - Project Name Input: uid=2_5
  - Create Button: uid=2_7
  
Project View Sidebar:
  - Projects Button: uid=4_1
  - Impact Graph Tab: uid=4_4
  - Folder Tree Tab: uid=4_5
  - Clustering Tab: uid=4_6
  
Folder Tree:
  - Folder Toggles: uid=5_X, 6_X (varies by folder)
  - Delete Button: uid=1_6 (in repos list)
```

## Random Name Generation

Projects are created with random names to avoid conflicts:

```python
def generate_random_name():
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{suffix}"  # e.g., "test_a3f9k2x7"
```

## Usage in VS Code with Copilot

When using these scenarios with GitHub Copilot and MCP Chrome:

1. **Start Chrome DevTools MCP Server** (if not auto-started)
2. **Open the URL**: `http://localhost:5173/repos`
3. **Ask Copilot to run a scenario**:
   ```
   Run the complete LFCA test scenario using MCP Chrome DevTools
   ```

4. **Copilot will execute the scenario** by:
   - Invoking MCP tool calls for each step
   - Capturing snapshots to find element UIDs
   - Taking screenshots at key points
   - Verifying expected outcomes

## Modular Testing

Run partial scenarios for specific testing needs:

### Create Project Only
```python
project_name = scenario_create_project(
    repo_path="/path/to/repo",
    project_name="my_test"  # or None for random
)
```

### Verify Tree Only
```python
scenario_verify_tree("existing_project_name")
```

### Delete Project Only
```python
scenario_delete_project("test_project_name")
```

## Screenshots

Screenshots are automatically saved at:
- `/tmp/impact_graph_{project_name}.png` - Impact Graph view
- `/tmp/folder_tree_{project_name}.png` - Folder Tree view (expanded)

## Error Handling

The scenarios include error handling for:
- Element not found (UID invalid)
- Timeout waiting for navigation
- Analysis failure
- Deletion confirmation

## Extending Scenarios

To add new test scenarios:

1. **Add a new method** to `LFCATestScenarioImplementation`
2. **Follow the naming pattern**: `step_N_description()`
3. **Document MCP commands** used in comments
4. **Include verification** steps

Example:
```python
def step_11_verify_clustering(self):
    """Step 11: Navigate to and verify clustering view."""
    print("=" * 60)
    print("STEP 11: Verify Clustering")
    print("=" * 60)
    
    # Click Clustering tab
    clustering_btn_uid = "4_6"
    self.mcp.click(clustering_btn_uid, include_snapshot=True)
    
    # Verify clusters displayed
    self.mcp.take_screenshot(f"/tmp/clustering_{self.project_name}.png")
    
    print("✓ Clustering view verified")
    print()
```

## CI/CD Integration

These scenarios can be integrated into CI/CD pipelines:

```bash
# In CI pipeline
# 1. Start LFCA backend
uvicorn lfca.api:app --host 0.0.0.0 --port 8000 &

# 2. Start frontend
cd frontend && npm run dev &

# 3. Wait for services
sleep 5

# 4. Run test scenario (via Copilot CLI or MCP client)
# This would be executed through the MCP server
python test_mcp_scenario.py full

# 5. Collect screenshots and logs
```

## Dependencies

- Python 3.8+
- MCP Chrome DevTools server (running)
- LFCA backend (running on port 8000)
- LFCA frontend (running on port 5173)
- Chrome/Chromium browser

## Best Practices

1. **Use random names** for test projects to avoid conflicts
2. **Always clean up** - delete test projects after testing
3. **Take screenshots** at verification points for debugging
4. **Verify state** before proceeding to next step
5. **Handle timeouts** gracefully with appropriate waits

## Troubleshooting

### Element UID not found
- Take a fresh snapshot to get updated UIDs
- UIDs may change between page loads
- Use `take_snapshot(verbose=True)` for detailed tree

### Navigation timeout
- Increase timeout values
- Check if backend is running and responsive
- Verify repository path is valid

### Project not deleted
- Check if confirmation dialog needs handling
- Verify project exists before deletion attempt
- Take snapshot to debug state

## See Also

- [MCP Chrome DevTools Documentation](https://github.com/modelcontextprotocol/servers)
- [LFCA Project Documentation](../../README.md)
- [QA Scripts](../README.md)
