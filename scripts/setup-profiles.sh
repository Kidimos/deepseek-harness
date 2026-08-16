#!/usr/bin/env bash
# Create the local DSH profiles used by this project (kidi-web and test-web).
# Run after scripts/setup-dsh-routing-suite.sh so ~/dsh-routing-suite exists.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILES_ROOT="$HOME/.dsh/profiles"
ROUTING_SUITE="$HOME/dsh-routing-suite"

mkdir -p "$PROFILES_ROOT"

write_profile() {
  local name="$1"
  local dir="$PROFILES_ROOT/$name"
  mkdir -p "$dir"

  cat > "$dir/package.json" <<EOF
{
  "name": "dsh-profile-$name",
  "private": true,
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@dsh-external/dsh-client-ui-skin-monokai",
        "@dsh-external/dsh-client-ui-toolbox",
        "@dsh-external/dsh-client-ui-file-preview"
EOF
  if [ "$name" = "test-web" ]; then
    cat >> "$dir/package.json" <<EOF
        ,
        "@dsh-external/dsh-super-injector"
EOF
  fi
  cat >> "$dir/package.json" <<EOF
      ]
    }
  },
  "dependencies": {
    "@dsh-external/dsh-client-ui-file-preview": "link:$REPO_ROOT/plugins/dsh-file-preview",
    "@dsh-external/dsh-client-ui-mcp-adapter": "link:$REPO_ROOT/plugins/dsh-mcp-adapter",
    "@dsh-external/dsh-client-ui-skin-monokai": "link:$REPO_ROOT/plugins/dsh-monokai",
    "@dsh-external/dsh-client-ui-toolbox": "link:$REPO_ROOT/plugins/dsh-toolbox"
EOF
  if [ "$name" = "test-web" ]; then
    cat >> "$dir/package.json" <<EOF
    ,
    "@dsh-external/dsh-super-injector": "link:$ROUTING_SUITE/injector",
    "@dsh-external/dsh-mode-boost": "link:$ROUTING_SUITE/mode-boost"
EOF
  fi
  cat >> "$dir/package.json" <<EOF
  }
}
EOF

  cat > "$dir/cordis.yml" <<'EOF'
# dsh profile root — an empty entry list. The tree is composed as patches:
# each bundle in package.json's dsh.profile.bundles, then cordis.patch.yml, then any
# --patch overlays. Edit cordis.patch.yml, not this file.
[]
EOF

  cat > "$dir/cordis.patch.yml" <<'EOF'
# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; `!!js` expressions allowed).
- insert:
    - id: mcp-adapter
      name: '@dsh-external/dsh-client-ui-mcp-adapter'
      config:
        servers:
          - serverName: gmail
            command: npx
            args:
              - -y
              - '@gongrzhe/server-gmail-autoauth-mcp'
EOF
  if [ "$name" = "test-web" ]; then
    cat >> "$dir/cordis.patch.yml" <<'EOF'
    - id: dsh-mode-boost
      name: '@dsh-external/dsh-mode-boost'
      config: {}
EOF
  fi

  cat > "$dir/pnpm-workspace.yaml" <<'EOF'
packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
EOF

  echo "Wrote $dir"
}

write_profile kidi-web
write_profile test-web

echo "==> Installing profile dependencies ..."
for name in kidi-web test-web; do
  echo "==> pnpm install in $PROFILES_ROOT/$name"
  (cd "$PROFILES_ROOT/$name" && pnpm install)
done

echo "==> Done."
echo "Start with:"
echo "  pnpm dsh --profile kidi-web"
echo "  pnpm dsh --profile test-web"
