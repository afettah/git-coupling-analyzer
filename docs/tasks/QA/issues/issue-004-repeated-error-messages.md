# Issue #004: File Details Error Message Repeated Multiple Times

## Description
When navigating to a non-existent file in the file details page, the error message "Error: HTTP_404 - File not found" is displayed multiple times (at least 4 times) instead of once.

## Severity
**Low** - UX issue, does not affect functionality

## Reproducibility
**Always**

## Likelihood
**Likely Real Issue** - Consistent reproduction with invalid file paths

## URL
- `http://localhost:5173/repos/openhands/file-details/nonexistent.txt`
- Any invalid file path like: `http://localhost:5173/repos/openhands/file-details/fake/path/file.txt`

## Expected Result
A single error message should appear:
```
Failed to load file details
Error: HTTP_404
File not found: nonexistent.txt
[Retry/Go Back button]
```

## Current Result
The error message appears 4 times in the UI:
```
Failed to load file details
Error: HTTP_404
File not found: nonexistent.txt
[button]
Error: HTTP_404
File not found: nonexistent.txt
[button]
Error: HTTP_404
File not found: nonexistent.txt
[button]
Error: HTTP_404
File not found: nonexistent.txt
[button]
```

## Steps to Reproduce
1. Navigate to OpenHands project
2. Go to URL: `http://localhost:5173/repos/openhands/file-details/nonexistent.txt`
3. Observe the repeated error messages

Alternative:
1. Use file search and type a non-existent file path
2. Try to view file details for a file that doesn't exist

## Root Cause
Likely a React component that renders error messages is being called multiple times, or the error state is being rendered multiple times without deduplication. Possible causes:
- Multiple error callbacks being triggered
- Error component rendered in multiple locations
- StrictMode double-rendering in development

## Additional Notes
- The error message content is correct ("File not found")
- The HTTP status code is correct (404)
- This is purely a UI rendering issue, not a logical issue
