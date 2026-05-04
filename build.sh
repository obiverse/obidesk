#!/bin/bash
# ============================================================================
# obiDesk build script
# ============================================================================
#
# Usage:
#   ./build.sh           # Build desk-search crate
#   ./build.sh docs      # Build + copy to docs/pkg/ + stamp SW
#   ./build.sh serve     # Build docs + start dev server
#   ./build.sh test      # Run all tests

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

stamp_sw() {
    VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
    echo "  → Stamping sw.js with version: $VERSION"
    sed -i '' "s/const CACHE = 'od-[^']*'/const CACHE = 'od-$VERSION'/" "$ROOT/docs/sw.js"
}

build_search() {
    echo "=== Desk Search ==="
    cd "$ROOT/crates/desk-search"
    wasm-pack build --target web --out-dir pkg
    echo "  → Built: crates/desk-search/pkg/"
}

build_docs() {
    echo "=== Copying to docs/pkg/ for GitHub Pages ==="
    mkdir -p "$ROOT/docs/pkg/desk-search"
    cp "$ROOT/crates/desk-search/pkg/desk_search_bg.wasm" "$ROOT/docs/pkg/desk-search/"
    cp "$ROOT/crates/desk-search/pkg/desk_search.js" "$ROOT/docs/pkg/desk-search/"
    echo "  → Copied to docs/pkg/"

    VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
    stamp_sw
    echo "{\"version\":\"$VERSION\",\"built\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$ROOT/docs/version.json"
    echo "  → Wrote docs/version.json"
}

run_tests() {
    echo "=== Running tests ==="
    cd "$ROOT"
    cargo test --workspace
    echo "  → All tests passed"
}

serve() {
    echo ""
    echo "=== Dev server ==="
    echo "  obiDesk: http://localhost:8080/"
    echo ""
    cd "$ROOT/docs"
    python3 -m http.server 8080
}

case "${1:-build}" in
    build)  build_search ;;
    docs)   build_search; build_docs ;;
    serve)  serve ;;
    test)   run_tests ;;
    stamp)  stamp_sw ;;
    *)      echo "Usage: $0 {build|docs|serve|test|stamp}"; exit 1 ;;
esac

echo ""
echo "Done."
