#!/usr/bin/env python3
"""
End-to-End Test for Analysis Flow
Tests the complete flow: server check -> create repo -> run analysis -> verify results
"""

import sys
import time
import requests
from pathlib import Path
from typing import Optional
import json
import uuid
import shutil

# Configuration
API_BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"
TEST_REPO_PATH = str(Path(__file__).parent.parent.absolute())
TIMEOUT_SECONDS = 300  # 5 minutes max for analysis


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'


def print_step(msg: str):
    print(f"\n{Colors.BLUE}▶ {msg}{Colors.RESET}")


def print_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")


def print_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")


def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.RESET}")


def generate_random_name() -> str:
    """Generate a random test repository name."""
    return f"test-e2e-{uuid.uuid4().hex[:8]}"


def check_server() -> bool:
    """Check if the server is running on port 5173."""
    print_step("Checking if server is running...")
    try:
        response = requests.get(FRONTEND_URL, timeout=5)
        print_success(f"Frontend is accessible at {FRONTEND_URL}")
        
        # Check API endpoint
        response = requests.get(f"{API_BASE_URL}/repos", timeout=5)
        if response.status_code == 200:
            print_success(f"API is accessible at {API_BASE_URL}")
            return True
        else:
            print_error(f"API returned status code {response.status_code}")
            return False
    except requests.ConnectionError:
        print_error(f"Cannot connect to server at {FRONTEND_URL}")
        print_warning("Please start the server with: npm run dev (in src/frontend)")
        return False
    except Exception as e:
        print_error(f"Error checking server: {e}")
        return False


def cleanup_test_repo(repo_id: str) -> bool:
    """Delete test repo and its data directory."""
    print_step(f"Cleaning up test repo: {repo_id}...")
    success = True
    
    # Delete via API
    try:
        delete_response = requests.delete(f"{API_BASE_URL}/repos/{repo_id}", timeout=10)
        if delete_response.status_code in [200, 204, 404]:
            print_success(f"Deleted repo via API: {repo_id}")
        else:
            print_warning(f"Could not delete repo via API {repo_id}: {delete_response.status_code}")
            success = False
    except Exception as e:
        print_warning(f"API cleanup failed: {e}")
        success = False
    
    # Delete data directory
    try:
        data_path = Path(__file__).parent.parent / "data" / "repos" / repo_id
        if data_path.exists():
            shutil.rmtree(data_path)
            print_success(f"Deleted data directory: {data_path}")
    except Exception as e:
        print_warning(f"Data directory cleanup failed: {e}")
        success = False
    
    return success


def create_repo(repo_name: str) -> Optional[str]:
    """Create a test repository."""
    print_step(f"Creating test repository '{repo_name}' from {TEST_REPO_PATH}...")
    try:
        payload = {
            "name": repo_name,
            "path": TEST_REPO_PATH
        }
        response = requests.post(f"{API_BASE_URL}/repos", json=payload, timeout=10)
        
        if response.status_code in [200, 201]:
            repo = response.json()
            repo_id = repo.get('id')
            print_success(f"Created repo: {repo_id}")
            print(f"   Name: {repo.get('name')}")
            print(f"   Path: {repo.get('local_path')}")
            return repo_id
        else:
            print_error(f"Failed to create repo: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print_error(f"Error creating repo: {e}")
        return None


def start_analysis(repo_id: str) -> bool:
    """Start git analysis for the repository."""
    print_step(f"Starting git analysis for repo: {repo_id}")
    try:
        payload = {
            "analyzer_type": "git",
            "config": {}
        }
        response = requests.post(
            f"{API_BASE_URL}/repos/{repo_id}/analyzers/run",
            json=payload,
            timeout=10
        )
        
        if response.status_code in [200, 201, 202]:
            print_success("Analysis started successfully")
            result = response.json()
            print(f"   Status: {result.get('status', 'unknown')}")
            return True
        else:
            print_error(f"Failed to start analysis: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error starting analysis: {e}")
        return False


def wait_for_analysis(repo_id: str) -> bool:
    """Wait for analysis to complete and return success status."""
    print_step("Waiting for analysis to complete...")
    start_time = time.time()
    last_progress = -1
    
    while time.time() - start_time < TIMEOUT_SECONDS:
        try:
            response = requests.get(
                f"{API_BASE_URL}/repos/{repo_id}/analyzers/git/status",
                timeout=5
            )
            
            if response.status_code != 200:
                print_warning(f"Status check returned {response.status_code}")
                time.sleep(3)
                continue
            
            status = response.json()
            state = status.get('state', 'unknown')
            progress = status.get('progress', 0)
            stage = status.get('stage', '')
            processed = status.get('processed_commits', 0)
            total = status.get('total_commits', 0)
            
            # Show progress update
            if progress != last_progress:
                elapsed = int(time.time() - start_time)
                print(f"   [{elapsed}s] {state.upper()}: {stage} - {int(progress*100)}% ({processed}/{total} commits)")
                last_progress = progress
            
            if state in ['complete', 'completed']:
                elapsed = int(time.time() - start_time)
                print_success(f"Analysis completed in {elapsed} seconds!")
                print(f"   Processed: {processed}/{total} commits")
                return True
            elif state == 'failed':
                error = status.get('error', 'Unknown error')
                print_error(f"Analysis failed: {error}")
                return False
            elif state in ['running', 'pending', 'queued']:
                time.sleep(3)
            else:
                print_warning(f"Unknown state: {state}")
                time.sleep(3)
                
        except Exception as e:
            print_warning(f"Error checking status: {e}")
            time.sleep(3)
    
    print_error(f"Analysis timed out after {TIMEOUT_SECONDS} seconds")
    return False


def verify_results(repo_id: str) -> bool:
    """Verify that analysis results are available."""
    print_step("Verifying analysis results...")
    
    tests = []
    
    # Test 1: Dashboard summary
    try:
        response = requests.get(f"{API_BASE_URL}/repos/{repo_id}/git/dashboard/summary", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print_success(f"Dashboard summary: {data.get('file_count', 0)} files, {data.get('commit_count', 0)} commits")
            tests.append(True)
        else:
            print_error(f"Dashboard summary failed: {response.status_code}")
            tests.append(False)
    except Exception as e:
        print_error(f"Dashboard summary error: {e}")
        tests.append(False)
    
    # Test 2: File list
    try:
        response = requests.get(f"{API_BASE_URL}/repos/{repo_id}/git/files", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                file_count = len(data)
            else:
                file_count = len(data.get('items', []))
            print_success(f"Files endpoint: {file_count} files")
            tests.append(True)
        else:
            print_error(f"Files endpoint failed: {response.status_code}")
            tests.append(False)
    except Exception as e:
        print_error(f"Files endpoint error: {e}")
        tests.append(False)
    
    # Test 3: Coupling graph
    try:
        response = requests.get(f"{API_BASE_URL}/repos/{repo_id}/git/graph", timeout=5)
        if response.status_code == 200:
            data = response.json()
            nodes = len(data.get('nodes', []))
            edges = len(data.get('edges', []))
            print_success(f"Coupling graph: {nodes} nodes, {edges} edges")
            tests.append(True)
        else:
            print_error(f"Coupling graph failed: {response.status_code}")
            tests.append(False)
    except Exception as e:
        print_error(f"Coupling graph error: {e}")
        tests.append(False)
    
    # Test 4: Hotspots
    try:
        response = requests.get(f"{API_BASE_URL}/repos/{repo_id}/git/hotspots", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                hotspots = len(data)
            else:
                hotspots = len(data.get('hotspots', []))
            print_success(f"Hotspots: {hotspots} files")
            tests.append(True)
        else:
            print_error(f"Hotspots failed: {response.status_code}")
            tests.append(False)
    except Exception as e:
        print_error(f"Hotspots error: {e}")
        tests.append(False)
    
    # Test 5: Authors
    try:
        response = requests.get(f"{API_BASE_URL}/repos/{repo_id}/git/authors", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                authors = len(data)
            else:
                authors = len(data.get('authors', []))
            print_success(f"Authors: {authors} contributors")
            tests.append(True)
        else:
            print_error(f"Authors failed: {response.status_code}")
            tests.append(False)
    except Exception as e:
        print_error(f"Authors error: {e}")
        tests.append(False)
    
    all_passed = all(tests)
    if all_passed:
        print_success(f"All {len(tests)} result checks passed!")
    else:
        failed = len([t for t in tests if not t])
        print_error(f"{failed}/{len(tests)} result checks failed")
    
    return all_passed


def main():
    """Run the complete end-to-end test."""
    print(f"\n{Colors.BLUE}{'='*60}")
    print("End-to-End Analysis Test")
    print(f"{'='*60}{Colors.RESET}\n")
    
    # Generate random name
    repo_name = generate_random_name()
    repo_id = None
    
    try:
        # Step 1: Check server
        if not check_server():
            print_error("\n❌ TEST FAILED: Server is not running")
            sys.exit(1)
        
        # Step 2: Create repo
        repo_id = create_repo(repo_name)
        if not repo_id:
            print_error("\n❌ TEST FAILED: Could not create repository")
            sys.exit(1)
        
        # Step 3: Start analysis
        if not start_analysis(repo_id):
            print_error("\n❌ TEST FAILED: Could not start analysis")
            cleanup_test_repo(repo_id)
            sys.exit(1)
        
        # Step 4: Wait for completion
        if not wait_for_analysis(repo_id):
            print_error("\n❌ TEST FAILED: Analysis did not complete successfully")
            cleanup_test_repo(repo_id)
            sys.exit(1)
        
        # Step 5: Verify results
        if not verify_results(repo_id):
            print_error("\n❌ TEST FAILED: Results verification failed")
            cleanup_test_repo(repo_id)
            sys.exit(1)
        
        # Success!
        print(f"\n{Colors.GREEN}{'='*60}")
        print("✅ ALL TESTS PASSED!")
        print(f"{'='*60}{Colors.RESET}\n")
        print(f"Dashboard URL: {FRONTEND_URL}/repos/{repo_id}/dashboard")
        print(f"Repository ID: {repo_id}\n")
        
    finally:
        # Cleanup
        if repo_id:
            print_step("Cleaning up test data...")
            cleanup_test_repo(repo_id)
            print_success("Cleanup complete")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Test interrupted by user{Colors.RESET}")
        sys.exit(130)
    except Exception as e:
        print_error(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
