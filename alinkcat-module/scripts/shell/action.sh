#!/system/bin/sh
# action.sh - action runner
# called from alnkcat_helper action

run_action() {
  local type="$1"; shift

  case "$type" in
    "shell")
      # run an arbitrary shell command (user confirms in the app first)
      sh -c "$*"
      ;;
    "service")
      # start/stop a system service
      local svc="$1"
      local op="${2:-start}"
      case "$op" in
        start)   /system/bin/start "$svc" 2>/dev/null ;;
        stop)    /system/bin/stop "$svc" 2>/dev/null ;;
        restart) /system/bin/restart "$svc" 2>/dev/null ;;
        *) echo "unknown operation: $op" >&2 ;;
      esac
      ;;
    "settings")
      # change system settings
      local ns="$1"; local key="$2"; local value="$3"
      [ -n "$ns" ] && [ -n "$key" ] && settings put "$ns" "$key" "$value"
      ;;
    "brightness")
      # brightness via root
      local val="$1"
      for f in /sys/class/backlight/*/brightness; do
        [ -f "$f" ] && echo "$val" > "$f" 2>/dev/null && break
      done
      ;;
    "input")
      # inject key events
      local key_code="$1"
      input keyevent "$key_code" 2>/dev/null
      ;;
    "pm")
      # package manager passthrough
      pm "$@" 2>/dev/null
      ;;
    *)
      echo "unsupported action: $type" >&2
      exit 1
      ;;
  esac
}