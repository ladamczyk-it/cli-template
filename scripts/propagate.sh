#!/usr/bin/env bash
# Syncs this template into each target repo and opens/updates a `chore/template-sync` PR.
# Env: GITHUB_TOKEN (contents + pull-requests write), TARGETS (space-separated repo names), CI_COMMIT_SHA.
set -uo pipefail

OWNER=ladamczyk-it
BRANCH=chore/template-sync
TEMPLATE_DIR=$(pwd)
WORK=$(mktemp -d)
SHA=${CI_COMMIT_SHA:-$(git rev-parse HEAD)}
failed=0

git config --global user.name "cli-template bot"
git config --global user.email "noreply@ladamczyk.it"

for repo in $TARGETS; do
  echo "::: $repo"
  dir="$WORK/$repo"
  if ! git clone -q "https://x-access-token:${GITHUB_TOKEN}@github.com/$OWNER/$repo.git" "$dir"; then
    echo "$repo: clone failed"; failed=1; continue
  fi
  base=$(git -C "$dir" symbolic-ref --short refs/remotes/origin/HEAD | sed 's@^origin/@@')
  git -C "$dir" checkout -q -B "$BRANCH"

  node "$TEMPLATE_DIR/scripts/sync.mjs" "$TEMPLATE_DIR" "$dir"
  if [ -z "$(git -C "$dir" status --porcelain)" ]; then
    echo "$repo: already in sync"; continue
  fi

  (cd "$dir" && npm install --ignore-scripts --no-audit --no-fund) || { echo "$repo: npm install failed"; failed=1; continue; }
  if (cd "$dir" && npm run husky:pre-push); then check="✅ \`husky:pre-push\` passed"; else check="❌ \`husky:pre-push\` failed: fix on this branch"; fi

  # The lockfile is regenerated locally after merge; the install above only feeds the check.
  git -C "$dir" checkout -q -- package-lock.json
  git -C "$dir" add -A
  git -C "$dir" commit -q -m "chore: sync with cli-template@${SHA:0:7}"
  git -C "$dir" push -q --force origin "$BRANCH" || { echo "$repo: push failed"; failed=1; continue; }

  body=$(node -e 'console.log(JSON.stringify({title: "chore: sync with cli-template", head: process.argv[1], base: process.argv[2], body: process.argv.slice(3).join("\n\n")}))' \
    "$BRANCH" "$base" "Synced from $OWNER/cli-template@$SHA." "$check")
  status=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$OWNER/$repo/pulls" -d "$body")
  # 422 = PR for this branch already open; the force-push above updated it.
  case $status in
    201) echo "$repo: PR opened ($check)" ;;
    422) echo "$repo: PR updated ($check)" ;;
    *) echo "$repo: PR API returned $status"; failed=1 ;;
  esac
done

exit $failed
