#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/../.."
git fetch origin develop
git checkout develop
git pull --ff-only origin develop
docker compose up --build -d
docker compose ps
