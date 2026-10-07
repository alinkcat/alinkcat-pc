#!/system/bin/sh
# config.sh - config read/write
# called from alnkcat_helper config

CONF="${0%/*}/../config/module.conf"
[ -f "$CONF" ] || CONF="/data/adb/modules/alinkcat_module/config/module.conf"

edit_config() {
  local action="$1"; shift

  case "$action" in
    get)
      local key="$1"
      [ -z "$key" ] && { cat "$CONF"; return; }
      grep "^${key}=" "$CONF" 2>/dev/null | cut -d= -f2 || echo "undefined"
      ;;
    set)
      local key="$1"; local value="$2"
      if [ -n "$key" ] && [ -n "$value" ]; then
        if grep -q "^${key}=" "$CONF" 2>/dev/null; then
          sed -i "s/^${key}=.*/${key}=${value}/" "$CONF"
        else
          echo "${key}=${value}" >> "$CONF"
        fi
        echo "ok"
      else
        echo "usage: config set <key> <value>" >&2
      fi
      ;;
    *)
      echo "usage: config <get|set>" >&2
      exit 1
      ;;
  esac
}