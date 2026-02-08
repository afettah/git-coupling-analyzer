# Task 05 - SSE Progress Streaming

## Objective

Expose real-time analysis progress over SSE and wire frontend to consume stage-level updates.

## Dependencies

1. Task 03.

## Detailed Implementation

## 1) Backend stream router

Create `src/platform/code_intel/routers/analysis_stream.py`.

Endpoint:

1. `GET /repos/{repo_id}/analysis/runs/{run_id}/stream`

Payload contract:

```json
{
  "state": "running",
  "progress": 0.53,
  "stage": "extracting_history",
  "entity_count": 9021,
  "relationship_count": 101233,
  "elapsed_seconds": 73,
  "error": null
}
```

Generator pseudocode:

```python
async def stream(run_id: str):
    last = None
    while True:
        t = storage.get_task(run_id)
        payload = map_task_to_progress(t)
        if payload != last:
            yield sse_event("progress", payload)
            last = payload
        if payload["state"] in ("completed", "failed"):
            break
        await asyncio.sleep(0.5)
```

## 2) Task update points

Ensure analysis updates task state at meaningful checkpoints:

1. queued
2. mirror complete
3. extraction progress
4. edge building progress
5. completed/failed

## 3) Frontend SSE hook

Create `src/frontend/src/hooks/useSSE.ts`:

1. event source setup
2. message parse + state updates
3. reconnect with capped backoff
4. cleanup on unmount/terminal state

Hook skeleton:

```ts
export function useSSE<T>(url: string, onData: (d: T) => void) {
  useEffect(() => {
    const es = new EventSource(url);
    es.addEventListener('progress', (e) => onData(JSON.parse((e as MessageEvent).data)));
    return () => es.close();
  }, [url, onData]);
}
```

## 4) UI integration

Create `AnalysisProgress.tsx` and integrate with wizard/configurator run flow.

Display:

1. state badge
2. progress bar
3. stage label
4. entity/relationship counters
5. elapsed time
6. terminal error details

## Verification Matrix

1. `curl -N` shows incremental events.
2. terminal states close stream cleanly.
3. reconnect behavior handles transient disconnects.
4. frontend updates in near real-time without polling.

## Definition of Done

1. SSE progress is stable and consumable by UI.
2. polling fallback remains optional compatibility path.

## Files To Touch

1. `src/platform/code_intel/routers/analysis_stream.py`
2. `src/platform/code_intel/storage.py`
3. `src/platform/code_intel/app.py`
4. `src/frontend/src/hooks/useSSE.ts`
5. `src/frontend/src/features/analysis-configurator/AnalysisProgress.tsx`

