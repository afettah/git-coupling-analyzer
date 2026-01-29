#!/bin/bash
# Frontend Component Generator
# Usage: ./scripts/generate-component.sh <ComponentName> [location]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_SRC="$(dirname "$SCRIPT_DIR")/frontend/src"

NAME="$1"
LOCATION="${2:-shared}"

# Validate
[[ -z "$NAME" ]] && { echo "Usage: $0 <ComponentName> [shared|views|<feature>]"; exit 1; }
[[ ! "$NAME" =~ ^[A-Z][a-zA-Z0-9]*$ ]] && { echo "Error: Use PascalCase (e.g., MyComponent)"; exit 1; }

# Resolve target
case "$LOCATION" in
    shared) DIR="$FRONTEND_SRC/components/shared" ;;
    views)  DIR="$FRONTEND_SRC/views" ;;
    *)      DIR="$FRONTEND_SRC/components/$LOCATION" ;;
esac

FILE="$DIR/$NAME.tsx"
[[ -f "$FILE" ]] && { echo "Error: $NAME already exists"; exit 1; }

mkdir -p "$DIR"

cat > "$FILE" << EOF
/**
 * $NAME Component
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';

export interface ${NAME}Props {
    className?: string;
    children?: React.ReactNode;
}

export const $NAME = memo(function $NAME({
    className,
    children
}: ${NAME}Props) {
    return (
        <div className={cn('p-4 bg-slate-900 border border-slate-800 rounded-xl', className)}>
            {children}
        </div>
    );
});
EOF

echo "✓ Created: $FILE"

# Auto-update index.ts for shared components
if [[ "$LOCATION" == "shared" && -f "$DIR/index.ts" ]]; then
    if ! grep -q "from './$NAME'" "$DIR/index.ts" 2>/dev/null; then
        echo "export { $NAME, type ${NAME}Props } from './$NAME';" >> "$DIR/index.ts"
        echo "✓ Exported in index.ts"
    fi
fi

echo "→ Import: import { $NAME } from '@/components/$LOCATION';"
