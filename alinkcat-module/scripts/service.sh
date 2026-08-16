#!/system/bin/sh
# 艾联猫模块服务
# 系统启动后由 Magisk/KSU 调用（service.sh）

MODDIR=${0%/*}
[ -f "$MODDIR/bin/alnkcat_helper" ] || exit 1

# 加载配置
CONF="$MODDIR/config/module.conf"
[ -f "$CONF" ] && . "$CONF"

# 启动守护进程（脱分离后台运行）
"$MODDIR/bin/alnkcat_helper" daemon >/dev/null 2>&1 &

# 标记服务已启动
touch "$MODDIR/.daemon_running"