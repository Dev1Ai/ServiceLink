#!/usr/bin/env bash
set -euo pipefail

# Requires: gh (GitHub CLI) and jq
# Usage:
#   scripts/ci-report.sh                   # infer current branch
#   scripts/ci-report.sh feat/export-csp-e2e
#   scripts/ci-report.sh --pr 123

branch=""
pr=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)
      pr="$2"; shift 2;;
    *)
      branch="$1"; shift;;
  esac
done

if [[ -n "$pr" ]]; then
  echo "# Resolving branch for PR #$pr"
  branch=$(gh pr view "$pr" --json headRefName -q .headRefName)
fi

if [[ -z "$branch" ]]; then
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
fi

if [[ -z "$branch" ]]; then
  echo "error: could not determine branch; pass a branch name or --pr <number>" >&2
  exit 1
fi

echo "# Investigating workflows for branch: $branch"

workflows=(
  "CI"
  "Web E2E"
  "Codex Milestone Report"
)

highlight_re='Error|Failed|Exception|Missing|Not found|Timeout|ENOENT|ECONN|EADDR|EACCES|Cannot|Traceback|TypeError|ReferenceError|SyntaxError'

for wf in "${workflows[@]}"; do
  echo "\n=== Workflow: $wf ==="
  runs_json=$(gh run list --branch "$branch" --workflow "$wf" --limit 1 --json databaseId,conclusion,headBranch,headSha,workflowName,displayTitle,url || true)
  run_id=$(echo "$runs_json" | jq -r '.[0].databaseId // empty')
  if [[ -z "$run_id" ]]; then
    echo "No recent runs for $wf on $branch"
    continue
  fi
  conclusion=$(echo "$runs_json" | jq -r '.[0].conclusion')
  url=$(echo "$runs_json" | jq -r '.[0].url')
  echo "Run: $run_id | Conclusion: $conclusion | $url"
  if [[ "$conclusion" == "success" ]]; then
    echo "Status: success"
    continue
  fi

  # Fetch jobs for the run
  jobs_json=$(gh run view "$run_id" --json jobs)
  echo "$jobs_json" | jq -r '.jobs[] | @json' | while read -r job_line; do
    name=$(echo "$job_line" | jq -r '.name')
    job_id=$(echo "$job_line" | jq -r '.id')
    job_conc=$(echo "$job_line" | jq -r '.conclusion')
    if [[ "$job_conc" == "success" ]]; then continue; fi
    echo "-- Job: $name (id=$job_id) | Conclusion: $job_conc"
    # Show last 20 lines of job log
    echo "Last 20 lines:";
    gh run view "$run_id" --job "$job_id" --log 2>/dev/null | tail -n 20 || echo "(no log)"
    echo "\nHighlights (matching errors):";
    gh run view "$run_id" --job "$job_id" --log 2>/dev/null | tail -n 300 | grep -E -i "$highlight_re" | tail -n 10 || echo "(no matches)"
  done
done

echo "\nDone."

