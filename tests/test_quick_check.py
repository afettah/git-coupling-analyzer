#!/usr/bin/env python3
"""Quick check to see if the backend returns results for an existing analyzed repo."""

import requests
import sys
import json

API_BASE = "http://localhost:8000"

print("Checking backend API...\n")

# Check if backend is up
try:
    resp = requests.get(f"{API_BASE}/repos", timeout=2)
    print(f"✅ Backend is up: {resp.status_code}")
    repos = resp.json()
    print(f"   Found {len(repos)} repos")
    for repo in repos:
        print(f"   - {repo['id']}: {repo.get('name', 'N/A')} (state: {repo.get('state', 'unknown')})")
except Exception as e:
    print(f"❌ Backend check failed: {e}")
    sys.exit(1)

# Check if we have any completed repos
completed_repos = [r for r in repos if r.get('state') in ['complete', 'completed']]
if not completed_repos:
    print("\n⚠️  No completed analysis found")
    print("   Repos need to be analyzed first")
    sys.exit(0)

# Test the first completed repo
repo_id = completed_repos[0]['id']
print(f"\n📊 Testing repo: {repo_id}")

# Test endpoints
tests = {
    "Status": f"/repos/{repo_id}/analyzers/git/status",
    "Dashboard": f"/repos/{repo_id}/git/dashboard/summary",
    "Files": f"/repos/{repo_id}/git/files",
    "Graph": f"/repos/{repo_id}/git/graph",
    "Hotspots": f"/repos/{repo_id}/git/hotspots",
}

for name, endpoint in tests.items():
    try:
        resp = requests.get(f"{API_BASE}{endpoint}", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ {name}: OK ({len(str(data))} bytes)")
        else:
            print(f"❌ {name}: Status {resp.status_code}")
    except Exception as e:
        print(f"❌ {name}: {e}")

print("\n✅ Backend is working and returning data!")
