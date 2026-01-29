#!/bin/bash
# Frontend Hook Generator
# Usage: ./scripts/generate-hook.sh <useHookName>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$(dirname "$SCRIPT_DIR")/frontend/src/hooks"

NAME="$1"

# Validate
[[ -z "$NAME" ]] && { echo "Usage: $0 <useHookName>"; exit 1; }
[[ ! "$NAME" =~ ^use[A-Z][a-zA-Z0-9]*$ ]] && { echo "Error: Must start with 'use' (e.g., useMyHook)"; exit 1; }

FILE="$HOOKS_DIR/$NAME.ts"
[[ -f "$FILE" ]] && { echo "Error: $NAME already exists"; exit 1; }

mkdir -p "$HOOKS_DIR"

cat > "$FILE" << EOF
/**
 * $NAME Hook
 */

import { useState, useCallback } from 'react';

export interface ${NAME}Options {
    // Define options here
}

export interface ${NAME}Result {
    isLoading: boolean;
}

export function $NAME(options: ${NAME}Options = {}): ${NAME}Result {
    const [isLoading, setIsLoading] = useState(false);

    return { isLoading };
}
EOF

echo "✓ Created: $FILE"

# Auto-update index.ts
if [[ -f "$HOOKS_DIR/index.ts" ]]; then
    if ! grep -q "from './$NAME'" "$HOOKS_DIR/index.ts" 2>/dev/null; then
        echo "export { $NAME, type ${NAME}Options, type ${NAME}Result } from './$NAME';" >> "$HOOKS_DIR/index.ts"
        echo "✓ Exported in index.ts"
    fi
fi

echo "→ Import: import { $NAME } from '@/hooks';"
