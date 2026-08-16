#!/usr/bin/env bash
# Plan A: keep dsh-routing-suite outside this repo and fetch it on demand.
# Usage:
#   bash scripts/setup-dsh-routing-suite.sh
#
# This script:
#   1. Clones dsh-routing-suite (with submodules) to $HOME/dsh-routing-suite
#      (override with DSH_ROUTING_SUITE_DIR).
#   2. Builds the injector against this DSH checkout.
#   3. Installs the Router Standard preset to ~/.dsh/.agent-presets/router-standard.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${DSH_ROUTING_SUITE_DIR:-$HOME/dsh-routing-suite}"
PRESET_DIR="$HOME/.dsh/.agent-presets/router-standard"

echo "==> dsh-routing-suite setup"
echo "    repo:   $REPO_ROOT"
echo "    target: $TARGET_DIR"

if [ ! -d "$TARGET_DIR/.git" ]; then
  echo "==> Cloning dsh-routing-suite ..."
  git clone --recurse-submodules https://github.com/yjh051108/dsh-routing-suite.git "$TARGET_DIR"
else
  echo "==> dsh-routing-suite already exists at $TARGET_DIR"
fi

echo "==> Linking @types/node for injector build ..."
mkdir -p "$TARGET_DIR/injector/node_modules/@types"
if [ ! -e "$TARGET_DIR/injector/node_modules/@types/node" ]; then
  ln -s "$REPO_ROOT/node_modules/@types/node" "$TARGET_DIR/injector/node_modules/@types/node"
fi

echo "==> Building injector ..."
(
  cd "$TARGET_DIR/injector"
  DSH_CHECKOUT="$REPO_ROOT" bash scripts/build.sh
)

echo "==> Installing Router Standard preset ..."
mkdir -p "$HOME/.dsh/.agent-presets"
if [ ! -d "$PRESET_DIR" ]; then
  cp -R "$TARGET_DIR/preset/preset/router-standard" "$PRESET_DIR"
  echo "    preset installed to $PRESET_DIR"
else
  echo "    preset already exists at $PRESET_DIR"
fi

echo "==> Done."
echo
echo "Use these paths in your profile package.json:"
echo "  $TARGET_DIR/injector"
echo "  $TARGET_DIR/mode-boost"
