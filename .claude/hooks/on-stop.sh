#!/bin/bash
# When Claude finishes responding, set the agent status to idle
# Task status is NOT changed — only the agent's completion workflow should do that

if [ -n "$FAMILIAR_TASK_ID" ] && command -v familiar >/dev/null 2>&1; then
  familiar update "$FAMILIAR_TASK_ID" --agent-status idle 2>/dev/null
fi

exit 0
