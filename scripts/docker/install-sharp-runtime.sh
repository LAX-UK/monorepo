#!/bin/sh
# Makes sharp loadable in a Next standalone output built on node:*-alpine (musl).
#
# The standalone trace keeps sharp's JS but not its platform addon or libvips: the addon finds
# libvips through its library path (rpath), not through `require`, so nothing traces it. This copies
# the pnpm-resolved sharp package, dereferenced so its dependencies and the musl addon/libvips for
# this CPU sit beside it, into the standalone output, links it where the app resolves "sharp", and
# fails the build if it cannot be loaded. Versions come from pnpm-lock.yaml; nothing is fetched.
#
# Usage (from the workspace root, in the build stage): install-sharp-runtime.sh <app-dir>
set -eu

app="${1:?usage: install-sharp-runtime.sh <app-dir, e.g. apps/web>}"
standalone="$app/.next/standalone"
store="node_modules/.pnpm"

libc="${SHARP_LIBC:-linuxmusl}" # glibc only for testing the script off Alpine
case "$(uname -m)" in
  x86_64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) echo "install-sharp-runtime: unsupported CPU $(uname -m)" >&2; exit 1 ;;
esac

set -- "$store"/sharp@*
[ "$#" = 1 ] && [ -d "$1/node_modules/sharp" ] || {
  echo "install-sharp-runtime: expected exactly one sharp in $store, found: $*" >&2
  exit 1
}
src="$1"
name="${src##*/}"
dest="$standalone/$store/$name"

rm -rf "$dest"
mkdir -p "$dest"
cp -RL "$src/." "$dest/"

# Keep only this CPU's addon and libvips (pnpm installs every supported platform).
for pkg in "$dest"/node_modules/@img/sharp-*; do
  case "${pkg##*/}" in
    "sharp-${libc}-$arch" | "sharp-libvips-${libc}-$arch") ;;
    *) rm -rf "$pkg" ;;
  esac
done
for pkg in "sharp-${libc}-$arch" "sharp-libvips-${libc}-$arch"; do
  [ -d "$dest/node_modules/@img/$pkg" ] || {
    echo "install-sharp-runtime: @img/$pkg missing from $src" >&2
    exit 1
  }
done

# Resolve "sharp" from the app and from the standalone root.
up=$(printf '%s/node_modules' "$app" | sed 's#[^/][^/]*#..#g')
mkdir -p "$standalone/$app/node_modules" "$standalone/node_modules"
ln -sfn "$up/$store/$name/node_modules/sharp" "$standalone/$app/node_modules/sharp"
ln -sfn "../$store/$name/node_modules/sharp" "$standalone/node_modules/sharp"

# Load it from the app directory exactly as the server will.
(cd "$standalone/$app" && node -e "const s=require('sharp');s({create:{width:2,height:2,channels:3,background:'#fff'}}).jpeg().toBuffer().then(b=>{if(!b.length)process.exit(1);console.log('sharp',s.versions.sharp,'libvips',s.versions.vips,'ok')})")
