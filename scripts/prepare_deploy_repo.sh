#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_REPO_URL="${DEPLOY_REPO_URL:-git@github.com-snsfb134:snsfb134/pr-compass-deploy.git}"
DEPLOY_DIR="${DEPLOY_DIR:-${ROOT_DIR}/../pr-compass-deploy}"

cd "$ROOT_DIR"

echo "Building Next.js standalone bundle..."
yarn --cwd web build

if [ ! -d "$DEPLOY_DIR/.git" ]; then
  echo "Cloning deployment repository into $DEPLOY_DIR"
  git clone "$DEPLOY_REPO_URL" "$DEPLOY_DIR"
fi

echo "Preparing deployment repository..."
mkdir -p "$DEPLOY_DIR"

rsync -a --delete \
  --exclude "__pycache__/" \
  --exclude "*.pyc" \
  app/ "$DEPLOY_DIR/app/"

rsync -a requirements.txt "$DEPLOY_DIR/requirements.txt"

mkdir -p "$DEPLOY_DIR/scripts"
rsync -a \
  scripts/check_once.py \
  scripts/deliver_mock_email_queue.py \
  scripts/replay_historical_update_flow.py \
  scripts/send_test_briefing_email.py \
  scripts/test_analysis_provider_contract.py \
  "$DEPLOY_DIR/scripts/"

rm -rf "$DEPLOY_DIR/web"
mkdir -p "$DEPLOY_DIR/web"
rsync -a web/.next/standalone/ "$DEPLOY_DIR/web/"
mkdir -p "$DEPLOY_DIR/web/.next"
rsync -a --delete web/.next/static/ "$DEPLOY_DIR/web/.next/static/"
if [ -d web/public ]; then
  rsync -a --delete web/public/ "$DEPLOY_DIR/web/public/"
fi

rsync -a deploy/ecosystem.config.cjs "$DEPLOY_DIR/ecosystem.config.cjs"
rsync -a deploy/README.md "$DEPLOY_DIR/README.md"

cat > "$DEPLOY_DIR/.gitignore" <<'EOF'
.env
.env.*
.venv/
node_modules/
web/node_modules/
data/
*.sqlite3
*.db
__pycache__/
*.pyc
EOF

echo "Deployment bundle prepared at $DEPLOY_DIR"
echo ""
echo "Next steps:"
echo "  cd $DEPLOY_DIR"
echo "  git status"
echo "  git add ."
echo "  git commit -m \"Deploy PR Compass MVP bundle\""
echo "  git push origin main"
