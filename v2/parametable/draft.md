# Parametrable Flow - Requirement Clarification (Consolidated)

This file captures the original intent behind the parametrable redesign in a normalized form.

## Core product expectations

1. After project creation, user sees an empty analysis state with clear run entrypoint.
2. User can configure analysis before execution.
3. User sees real-time progress during execution.
4. Project tree knowledge is precomputed and queryable in backend.
5. Tree is explorable and reusable across screens.

## Required parameter capabilities

1. Commit range (`since`, `until`, refs).
2. Include/exclude authors.
3. Include/exclude commit size thresholds.
4. Include/exclude paths and patterns.
5. Include/exclude extensions.
6. Presets/dictionaries by stack (example: dotnet, react, python).
7. Advanced git options and performance controls.

## UX requirements

1. Live tree preview updates as parameters change.
2. Default values are sensible and grouped by categories.
3. Advanced options are available without overloading default path.
4. Invalid parameter combinations produce clear, field-level errors.

## Non-functional requirements

1. Large project support is mandatory.
2. System must remain extensible for new parameters and presets.
3. Behavior must be consistent across all supported parameter combinations.

## Reference

Parameter audit source: `v2/parametable/PARAMS_IMPLEMENTATION_REVIEW.md`

