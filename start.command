#!/usr/bin/env bash
# Double-clickable launcher for macOS Finder.
# It just runs start.sh from this folder and keeps the window open on error.
cd "$(dirname "$0")"
./start.sh
STATUS=$?
if [ $STATUS -ne 0 ]; then
  echo
  echo "Something went wrong (exit code $STATUS). Read the message above."
  echo "Press Return to close this window."
  read -r _
fi
