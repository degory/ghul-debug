#!/bin/bash
set -euo pipefail

# Set the version in package.json from a single source argument.
# Used by the CI workflow before `vsce package`. Matches the
# corresponding script in ghul-vsce — single-package layout here
# so there's only one package.json to touch.

version=$1

npm --prefix ./ version --no-git-tag --allow-same-version "$version"
