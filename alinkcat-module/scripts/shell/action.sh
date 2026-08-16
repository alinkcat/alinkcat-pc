#!/system/bin/sh
# action.sh —— 动作执行核心
# 由 alnkcat_helper action 调用

run_action() {
  local type="$1"; shift

  case "$type" in
    "shell")
      # 执行任意 shell 脚本（需用户确认）
      sh -c "$*"
      ;;
    "service")
      # 启动/停止系统服务
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
      # 修改系统设置（需 root）
      local ns="$1"; local key="$2"; local value="$3"
      [ -n "$ns" ] && [ -n "$key" ] && settings put "$ns" "$key" "$value"
      ;;
    "brightness")
      # root 级亮度控制
      local val="$1"
      for f in /sys/class/backlight/*/brightness; do
        [ -f "$f" ] && echo "$val" > "$f" 2>/dev/null && break
      done
      ;;
    "input")
      # 模拟按键
      local key_code="$1"
      input keyevent "$key_code" 2>/dev/null
      ;;
    "pm")
      # 包管理操作
      pm "$@" 2>/dev/null
      ;;
    *)
      echo "unsupported action: $type" >&2
      exit 1
      ;;
  esac
}