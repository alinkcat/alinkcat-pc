#!/system/bin/sh
# monitor.sh —— 深层硬件数据获取
# 由 alnkcat_helper monitor 调用
# 读取系统文件节点，绕过 Android 权限限制

# ─── CPU ────────────────────────────────────────

get_cpu_usage() {
  # 读取 /proc/stat 计算 CPU 使用率
  local cpu_line
  cpu_line=$(grep '^cpu ' /proc/stat 2>/dev/null) || return
  set -- $cpu_line
  local total=$(( $2 + $3 + $4 + $5 + $6 + $7 + $8 ))
  local idle=$5
  # 此处简化：输出原始值，App 端处理差值
  echo "total=$total idle=$idle"
}

get_cpu_temp() {
  for f in /sys/class/thermal/thermal_zone*/temp; do
    [ -f "$f" ] && { cat "$f" 2>/dev/null; return; }
  done
  echo "0"
}

get_cpu_freq() {
  for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq; do
    [ -f "$cpu" ] && echo "$(basename $(dirname $(dirname $cpu))) $(cat $cpu 2>/dev/null)kHz"
  done
}

get_cpu() {
  case "$1" in
    usage) get_cpu_usage ;;
    temp)  get_cpu_temp ;;
    freq)  get_cpu_freq ;;
    all)
      echo "cpu_usage: $(get_cpu_usage)"
      echo "cpu_temp: $(get_cpu_temp)°C"
      echo "cpu_freq:"
      get_cpu_freq
      ;;
  esac
}

# ─── 电池 ────────────────────────────────────────

get_battery_volt() {
  cat /sys/class/power_supply/battery/voltage_now 2>/dev/null || echo "0"
}

get_battery_temp() {
  cat /sys/class/power_supply/battery/temp 2>/dev/null || echo "0"
}

get_battery_current() {
  cat /sys/class/power_supply/battery/current_now 2>/dev/null || \
  cat /sys/class/power_supply/battery/batt_current 2>/dev/null || echo "0"
}

get_battery_level() {
  cat /sys/class/power_supply/battery/capacity 2>/dev/null || \
  dumpsys battery 2>/dev/null | grep level | awk '{print $2}' || echo "0"
}

get_battery() {
  case "$1" in
    volt)    get_battery_volt ;;
    temp)    get_battery_temp ;;
    current) get_battery_current ;;
    level)   get_battery_level ;;
    all)
      echo "battery_level: $(get_battery_level)%"
      echo "battery_voltage: $(get_battery_volt)µV"
      echo "battery_temperature: $(get_battery_temp)°C"
      echo "battery_current: $(get_battery_current)µA"
      ;;
  esac
}

# ─── GPU ─────────────────────────────────────────

get_gpu_freq() {
  cat /sys/class/kgsl/kgsl-3d0/gpuclk 2>/dev/null || \
  cat /sys/class/kgsl/kgsl-3d0/devfreq/*/cur_freq 2>/dev/null || \
  cat /sys/class/misc/mali0/device/devfreq/*/cur_freq 2>/dev/null || \
  echo "0"
}

get_gpu() {
  echo "gpu_freq: $(get_gpu_freq)Hz"
}

# ─── 内存 ────────────────────────────────────────

get_memory() {
  local mem_total=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')
  local mem_free=$(grep MemFree /proc/meminfo 2>/dev/null | awk '{print $2}')
  local mem_avail=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}')
  echo "mem_total: ${mem_total:-0}kB"
  echo "mem_free: ${mem_free:-0}kB"
  echo "mem_available: ${mem_avail:-0}kB"
}

# ─── 全部 ────────────────────────────────────────

get_all() {
  echo "=== CPU ===";  get_cpu all
  echo "=== BATTERY ==="; get_battery all
  echo "=== GPU ===";  get_gpu
  echo "=== MEMORY ==="; get_memory
}