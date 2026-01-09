#!/usr/bin/env bash
# exit on error
set -o errexit

STORAGE_DIR=/opt/render/project/.render

CHROME_BINARY="$STORAGE_DIR/chrome/opt/google/chrome/google-chrome"

if [[ ! -f "$CHROME_BINARY" ]]; then
  echo "...Downloading Chrome"
  rm -rf $STORAGE_DIR/chrome
  mkdir -p $STORAGE_DIR/chrome
  cd $STORAGE_DIR/chrome
  wget -P ./ https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  dpkg -x ./google-chrome-stable_current_amd64.deb $STORAGE_DIR/chrome
  rm ./google-chrome-stable_current_amd64.deb
  cd /opt/render/project/src
else
  echo "...Using Chrome from cache"
fi

# Install Python dependencies
pip install -r backend/requirements.txt
