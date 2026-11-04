#!/usr/bin/env bash
# 使い方: bash retry.sh node summarize4.js
# 失敗したら30秒待って1回だけ再トライ。それでも失敗なら終了コード1（工程側で飛ばして先へ進む）
for attempt in 1 2; do
  if "$@"; then exit 0; fi
  echo "::warning::失敗 ($attempt/2): $*"
  [ "$attempt" = 1 ] && sleep 30
done
echo "::error::2回失敗したため、この工程を外して公開へ進みます: $*"
exit 1
