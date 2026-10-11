#!/usr/bin/env bash
# capture-screenshots.sh — product-wiki 截圖採集 + staleness 偵測
# 用法：在 docs/products/<product>/ 目錄下執行
#
#   list         列出 markdown 引用了但檔案不存在的截圖
#   capture      引導式採集單張（macOS 互動截圖 / Playwright 自動）
#   process      後處理（縮放 + strip EXIF + 壓縮）
#   check        健康檢查（命名 / 大小 / 孤兒）
#   staleness    Tier 3 — 偵測「源代碼改了但截圖沒更新」(讀 sidecar .meta.json)
#   install-hook 安裝 git pre-commit hook（warning 模式，不阻擋 commit）
#
# Sidecar schema（每張截圖配同名 .meta.json）：
#   {
#     "captured": "2026-05-10T22:30:00Z",   // ISO8601 timestamp
#     "sources": ["path/to/x.js", "..."],    // 相對 git root 的源檔案路徑
#     "url": "http://localhost:...",         // 可選：截圖時的 URL
#     "selector": ".xxx",                    // 可選：Playwright 用的 selector
#     "viewport": "1440x900",                // 可選
#     "method": "manual" | "playwright"
#   }

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCREENSHOTS_DIR="$DOC_ROOT/screenshots"

# 找 git root（給 staleness 用）
GIT_ROOT="$(cd "$DOC_ROOT" && git rev-parse --show-toplevel 2>/dev/null || echo "")"

C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YELLOW='\033[1;33m'
C_BLUE='\033[0;34m'; C_GRAY='\033[0;37m'; C_RESET='\033[0m'

cmd="${1:-help}"

# ─── helper：寫 sidecar ──────────────────────────────────────────────
write_sidecar() {
  local screenshot_path="$1"
  local sources="$2"      # 空格分隔
  local url="${3:-}"
  local selector="${4:-}"
  local viewport="${5:-}"
  local method="${6:-manual}"

  local sidecar="${screenshot_path%.png}.meta.json"
  local now_iso
  now_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  # sources 轉 JSON array
  local sources_json="[]"
  if [ -n "$sources" ]; then
    sources_json='['
    local first=true
    for s in $sources; do
      if [ "$first" = true ]; then first=false; else sources_json+=','; fi
      sources_json+="\"$s\""
    done
    sources_json+=']'
  fi

  cat > "$sidecar" <<EOF
{
  "captured": "$now_iso",
  "sources": $sources_json,
  "url": "$url",
  "selector": "$selector",
  "viewport": "$viewport",
  "method": "$method"
}
EOF
  echo -e "  ${C_GRAY}↳ sidecar:${C_RESET} ${sidecar#$DOC_ROOT/}"
}

# ─── helper：從 git 取檔案最後修改時間 ────────────────────────────────
git_mtime_iso() {
  local file="$1"
  if [ -z "$GIT_ROOT" ]; then
    # 無 git，fallback 到 fs mtime
    if [ -f "$file" ]; then
      stat -f "%Sm" -t "%Y-%m-%dT%H:%M:%SZ" "$file" 2>/dev/null || echo ""
    fi
    return
  fi
  (cd "$GIT_ROOT" && git log -1 --format=%cI -- "$file" 2>/dev/null) || echo ""
}

case "$cmd" in
  # ─────────────────────────────────────────────────────────────────
  list)
    echo -e "${C_BLUE}=== 待截圖（markdown 引用了但檔案不存在） ===${C_RESET}"
    missing=()
    while IFS= read -r line; do
      file="$(echo "$line" | cut -d: -f1)"
      ref="$(echo "$line" | grep -oE 'screenshots/[^)" ]+\.(png|jpg|jpeg)' | head -1)"
      [ -z "$ref" ] && continue
      abspath="$DOC_ROOT/$ref"
      if [ ! -f "$abspath" ]; then
        if [[ ! " ${missing[*]:-} " =~ " ${ref} " ]]; then
          missing+=("$ref")
          relmd="${file#$DOC_ROOT/}"
          printf "${C_YELLOW}%s${C_RESET}\n  ← 引用自 %s\n" "$ref" "$relmd"
        fi
      fi
    done < <(grep -rn "screenshots/[^)\" ]*\.\(png\|jpg\|jpeg\)" "$DOC_ROOT" --include="*.md" --include="*.html" 2>/dev/null || true)

    if [ ${#missing[@]} -eq 0 ]; then
      echo -e "${C_GREEN}✓ 全部截圖到位${C_RESET}"
    else
      echo ""
      echo -e "共 ${C_RED}${#missing[@]}${C_RESET} 張待截"
      echo ""
      echo -e "${C_GRAY}下一步：${C_RESET}"
      echo -e "  ./scripts/capture-screenshots.sh capture <relpath-without-ext>"
    fi
    ;;

  # ─────────────────────────────────────────────────────────────────
  capture)
    target="${2:-}"
    if [ -z "$target" ]; then
      echo -e "${C_RED}用法：${C_RESET}capture <relpath> [--sources=...] [--playwright --url=... [--selector=...]]"
      echo "  範例：capture functional/stage-2/01-dashboard --sources='src/stages/stage2.js,web/X.tsx'"
      exit 1
    fi
    target="${target%.png}"

    use_playwright=false
    pw_url=""
    pw_selector=""
    sources=""
    shift 2 || true
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --playwright)  use_playwright=true ;;
        --url=*)       pw_url="${1#*=}" ;;
        --selector=*)  pw_selector="${1#*=}" ;;
        --sources=*)   sources="${1#*=}"; sources="${sources//,/ }" ;;
      esac
      shift
    done

    out_path="$SCREENSHOTS_DIR/$target.png"
    out_dir="$(dirname "$out_path")"
    mkdir -p "$out_dir"

    method="manual"
    if [ "$use_playwright" = true ]; then
      [ -z "$pw_url" ] && { echo -e "${C_RED}--playwright 需要 --url=<url>${C_RESET}"; exit 1; }
      echo -e "${C_BLUE}[Playwright] 截圖中...${C_RESET}"
      sel_arg=""
      [ -n "$pw_selector" ] && sel_arg="--selector=\"$pw_selector\""
      npx --yes playwright@latest screenshot $sel_arg --wait-for-timeout=2000 --viewport-size=1440,900 "$pw_url" "$out_path" || {
        echo -e "${C_RED}Playwright 失敗。試裝：npx playwright install chromium${C_RESET}"
        exit 1
      }
      method="playwright"
      echo -e "${C_GREEN}✓ 截圖完成：${C_RESET}$out_path"
    else
      command -v screencapture > /dev/null || { echo -e "${C_RED}非 macOS。請手動截到：${C_RESET}$out_path"; exit 1; }
      echo -e "${C_BLUE}[手動截圖]${C_RESET} 目標：$out_path"
      echo -e "${C_YELLOW}操作：${C_RESET}切到目標視窗 → 框選區域"
      read -rp "按 Enter 開始..."
      screencapture -i -x -t png "$out_path"
      [ -f "$out_path" ] || { echo -e "${C_RED}✗ 截圖未產生${C_RESET}"; exit 1; }
      size=$(du -h "$out_path" | awk '{print $1}')
      echo -e "${C_GREEN}✓ 截圖完成${C_RESET}（$size）"
    fi

    # ── Sidecar (Tier 3) ────
    if [ -z "$sources" ]; then
      echo ""
      echo -e "${C_YELLOW}📎 staleness 檢測需要登記源檔案。${C_RESET}"
      echo "   這張截圖跟哪些源代碼相關？（相對 repo root 路徑，空格分隔）"
      echo "   例：src/skills/brain-training/stages/stage2.js web-dashboard/components/X.tsx"
      echo "   按 Enter 跳過（之後 staleness 會 warn 此圖無法檢測）"
      read -rp "> " sources
    fi
    write_sidecar "$out_path" "$sources" "$pw_url" "$pw_selector" "1440x900" "$method"

    echo ""
    echo -e "${C_GRAY}下一步：${C_RESET}"
    echo "  ./scripts/capture-screenshots.sh process    # 縮放 + 壓縮"
    echo "  ./scripts/capture-screenshots.sh staleness  # 確認 sidecar 寫對"
    ;;

  # ─────────────────────────────────────────────────────────────────
  process)
    echo -e "${C_BLUE}=== 後處理 ===${C_RESET}"
    has_sips=false; has_pngquant=false; has_exiftool=false
    command -v sips > /dev/null && has_sips=true
    command -v pngquant > /dev/null && has_pngquant=true
    command -v exiftool > /dev/null && has_exiftool=true

    [ "$has_sips" = false ] && echo -e "${C_YELLOW}⚠ 缺 sips${C_RESET}"
    [ "$has_pngquant" = false ] && echo -e "${C_YELLOW}⚠ 缺 pngquant（brew install pngquant）${C_RESET}"
    [ "$has_exiftool" = false ] && echo -e "${C_YELLOW}⚠ 缺 exiftool（brew install exiftool）${C_RESET}"

    count=0
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      count=$((count+1))
      if [ "$has_sips" = true ]; then
        width=$(sips -g pixelWidth "$f" 2>/dev/null | awk '/pixelWidth/ {print $2}')
        if [ -n "$width" ] && [ "$width" -gt 1280 ]; then
          sips --resampleWidth 1280 "$f" --out "$f" > /dev/null 2>&1
          echo -e "  ${C_GREEN}↓${C_RESET} 縮放：$f"
        fi
      fi
      [ "$has_exiftool" = true ] && exiftool -overwrite_original -all= "$f" > /dev/null 2>&1
      if [ "$has_pngquant" = true ]; then
        size_kb=$(du -k "$f" | awk '{print $1}')
        if [ "$size_kb" -gt 500 ]; then
          pngquant --force --output "$f" --quality=70-90 "$f" 2>/dev/null && \
            echo -e "  ${C_GREEN}⇣${C_RESET} 壓縮：$f"
        fi
      fi
    done < <(find "$SCREENSHOTS_DIR" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) 2>/dev/null)
    echo -e "${C_GREEN}✓ 處理完成：${C_RESET}$count 個檔案"
    ;;

  # ─────────────────────────────────────────────────────────────────
  check)
    echo -e "${C_BLUE}=== 健康檢查 ===${C_RESET}"
    issues=0
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      base="$(basename "$f")"
      if ! echo "$base" | grep -qE '^[0-9]{2}-[a-z0-9-]+\.(png|jpg|jpeg)$'; then
        echo -e "  ${C_RED}✗ 命名不規範：${C_RESET}$f"
        issues=$((issues+1))
      fi
      size_kb=$(du -k "$f" | awk '{print $1}')
      if [ "$size_kb" -gt 500 ]; then
        echo -e "  ${C_YELLOW}⚠ 過大（${size_kb}KB）：${C_RESET}$f"
        issues=$((issues+1))
      fi
      relpath="${f#$DOC_ROOT/}"
      if ! grep -rq "$relpath" "$DOC_ROOT" --include="*.md" --include="*.html" 2>/dev/null; then
        echo -e "  ${C_GRAY}? 未被引用（孤兒）：${C_RESET}$relpath"
        issues=$((issues+1))
      fi
    done < <(find "$SCREENSHOTS_DIR" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) 2>/dev/null)
    [ "$issues" -eq 0 ] && echo -e "${C_GREEN}✓ 全部健康${C_RESET}" || echo -e "共 ${C_YELLOW}$issues${C_RESET} 個問題"
    ;;

  # ─────────────────────────────────────────────────────────────────
  staleness)
    quiet=false
    [ "${2:-}" = "--quiet" ] && quiet=true

    [ "$quiet" = false ] && echo -e "${C_BLUE}=== Staleness 檢測（源代碼 vs 截圖時間） ===${C_RESET}"

    if [ -z "$GIT_ROOT" ]; then
      echo -e "${C_RED}✗ 不在 git repo 內，無法檢測${C_RESET}"
      exit 1
    fi

    stale=0
    no_meta=0
    missing_src=0
    fresh=0

    while IFS= read -r f; do
      [ -z "$f" ] && continue
      sidecar="${f%.png}.meta.json"
      relpath="${f#$DOC_ROOT/}"

      if [ ! -f "$sidecar" ]; then
        no_meta=$((no_meta+1))
        [ "$quiet" = false ] && echo -e "  ${C_YELLOW}⚠ no metadata:${C_RESET} $relpath"
        continue
      fi

      # 用 jq 解析（有 jq 的話），否則 grep
      if command -v jq > /dev/null; then
        captured=$(jq -r '.captured // ""' "$sidecar" 2>/dev/null)
        sources=$(jq -r '.sources[]? // empty' "$sidecar" 2>/dev/null)
      else
        captured=$(grep -oE '"captured":\s*"[^"]+"' "$sidecar" | sed 's/.*: *"\(.*\)"/\1/')
        sources=$(grep -A1000 '"sources"' "$sidecar" | grep -oE '"[^"]+\.(js|ts|tsx|jsx|py|go|rs|java|kt|swift|html|css|vue|svelte|md)[^"]*"' | tr -d '"' | grep -v '^sources$' || true)
      fi

      if [ -z "$captured" ]; then
        no_meta=$((no_meta+1))
        [ "$quiet" = false ] && echo -e "  ${C_YELLOW}⚠ sidecar 無 captured 時間:${C_RESET} $relpath"
        continue
      fi

      if [ -z "$sources" ]; then
        no_meta=$((no_meta+1))
        [ "$quiet" = false ] && echo -e "  ${C_YELLOW}⚠ sidecar 無 sources:${C_RESET} $relpath"
        continue
      fi

      page_stale=false
      while IFS= read -r src; do
        [ -z "$src" ] && continue
        src_abs="$GIT_ROOT/$src"
        if [ ! -f "$src_abs" ]; then
          missing_src=$((missing_src+1))
          [ "$quiet" = false ] && echo -e "  ${C_RED}🗑 source removed:${C_RESET} $src ${C_GRAY}← $relpath${C_RESET}"
          continue
        fi
        src_mtime=$(git_mtime_iso "$src")
        if [ -n "$src_mtime" ] && [[ "$src_mtime" > "$captured" ]]; then
          if [ "$page_stale" = false ]; then
            stale=$((stale+1))
            page_stale=true
            echo -e "  ${C_RED}📅 stale:${C_RESET} $relpath"
            echo -e "     ${C_GRAY}captured:${C_RESET} $captured"
          fi
          echo -e "     ${C_RED}↳ $src${C_RESET} ${C_GRAY}modified $src_mtime${C_RESET}"
        fi
      done <<< "$sources"

      if [ "$page_stale" = false ]; then
        fresh=$((fresh+1))
      fi
    done < <(find "$SCREENSHOTS_DIR" -type f -name "*.png" 2>/dev/null)

    echo ""
    if [ "$quiet" = false ]; then
      echo -e "${C_BLUE}=== 摘要 ===${C_RESET}"
      echo -e "  ${C_GREEN}✓ fresh:${C_RESET}        $fresh"
      echo -e "  ${C_RED}📅 stale:${C_RESET}        $stale"
      echo -e "  ${C_YELLOW}⚠ no metadata:${C_RESET}  $no_meta"
      echo -e "  ${C_RED}🗑 missing src:${C_RESET}  $missing_src"
    fi

    if [ "$stale" -gt 0 ]; then
      echo ""
      echo -e "${C_YELLOW}下一步：${C_RESET}重截 stale 的截圖："
      echo -e "  ./scripts/capture-screenshots.sh capture <relpath-without-ext>"
    fi

    # exit code: 0 if all fresh, 1 if any stale (for hook)
    [ "$stale" -eq 0 ]
    ;;

  # ─────────────────────────────────────────────────────────────────
  install-hook)
    [ -z "$GIT_ROOT" ] && { echo -e "${C_RED}不在 git repo 內${C_RESET}"; exit 1; }
    HOOK_PATH="$GIT_ROOT/.git/hooks/pre-commit"

    # 取相對 repo root 的 docs 路徑
    DOC_REL="${DOC_ROOT#$GIT_ROOT/}"

    cat > "$HOOK_PATH" <<EOF
#!/usr/bin/env bash
# Auto-installed by product-wiki capture-screenshots.sh install-hook
# 警告 staleness 但不阻擋 commit
cd "\$(git rev-parse --show-toplevel)/$DOC_REL" 2>/dev/null || exit 0
[ -x ./scripts/capture-screenshots.sh ] || exit 0

OUTPUT=\$(./scripts/capture-screenshots.sh staleness 2>&1)
EXIT=\$?

if [ \$EXIT -ne 0 ]; then
  echo ""
  echo -e "\033[1;33m⚠ 截圖過期警告（不阻擋 commit）\033[0m"
  echo "\$OUTPUT" | grep -E "stale|removed|↳" | head -20
  echo ""
  echo "  跑 ./scripts/capture-screenshots.sh staleness 看完整列表"
  echo ""
fi
exit 0
EOF
    chmod +x "$HOOK_PATH"
    echo -e "${C_GREEN}✓ git hook 已安裝：${C_RESET}$HOOK_PATH"
    echo "  每次 commit 會跑 staleness 檢測"
    echo "  ${C_GRAY}（warning 模式 — 即使 stale 也不阻擋 commit）${C_RESET}"
    ;;

  # ─────────────────────────────────────────────────────────────────
  help|*)
    cat <<EOF
$(echo -e "${C_BLUE}capture-screenshots.sh${C_RESET}") — product-wiki 截圖採集 + staleness 偵測

用法（在 docs/products/<product>/ 下執行）：

  $(echo -e "${C_GREEN}list${C_RESET}")                            列出 markdown 引用了但檔案不存在的截圖
  $(echo -e "${C_GREEN}capture${C_RESET}") <relpath>              引導式採集（macOS 互動截圖）
  $(echo -e "${C_GREEN}capture${C_RESET}") <relpath> \\
    --sources=<file1,file2>          (建議) 一併登記對應源檔案 → 寫 sidecar
    --playwright --url=<url>         Playwright 自動截
    [--selector=<css>]
  $(echo -e "${C_GREEN}process${C_RESET}")                         後處理（縮放 1280 + strip + 壓縮）
  $(echo -e "${C_GREEN}check${C_RESET}")                           健康檢查（命名 / 大小 / 孤兒）
  $(echo -e "${C_GREEN}staleness${C_RESET}") $(echo -e "${C_GRAY}[Tier 3]${C_RESET}")              偵測「源代碼改了但截圖沒更新」
  $(echo -e "${C_GREEN}staleness --quiet${C_RESET}")              只列 stale，給 git hook 用
  $(echo -e "${C_GREEN}install-hook${C_RESET}") $(echo -e "${C_GRAY}[Tier 3]${C_RESET}")           安裝 git pre-commit hook（warning 模式）
  $(echo -e "${C_GREEN}help${C_RESET}")                            本說明

$(echo -e "${C_GRAY}範例：${C_RESET}")
  ./scripts/capture-screenshots.sh list
  ./scripts/capture-screenshots.sh capture functional/stage-2/01-dashboard \\
    --sources='src/stages/stage2.js web/X.tsx'
  ./scripts/capture-screenshots.sh capture overview/kpi/01-stats \\
    --playwright --url=http://localhost:3005/dashboard
  ./scripts/capture-screenshots.sh process
  ./scripts/capture-screenshots.sh staleness
  ./scripts/capture-screenshots.sh install-hook

$(echo -e "${C_GRAY}Sidecar (.meta.json) — 給 staleness 用：${C_RESET}")
  每張截圖配一個同名 .meta.json
  capture 指令會自動生成（互動詢問或從 --sources= flag 讀）
  staleness 從 git log 取源檔案 mtime，比 sidecar 的 captured 新 = stale

$(echo -e "${C_GRAY}依賴：${C_RESET}")
  必須：bash, find, grep, git
  建議：sips, jq, pngquant, exiftool, npx playwright
  安裝：brew install jq pngquant exiftool

$(echo -e "${C_GRAY}規範：${C_RESET}")
  詳見 docs/products/<product>/screenshot-conventions.md
EOF
    ;;
esac
