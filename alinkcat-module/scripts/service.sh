#!/system/bin/sh
# alinkcat module service
# invoked by Magisk/KSU after boot (service.sh)

MODDIR=${0%/*}
[ -f "$MODDIR/bin/alnkcat_helper" ] || exit 1

# load config
CONF="$MODDIR/config/module.conf"
[ -f "$CONF" ] && . "$CONF"

# start the daemon, detached
"$MODDIR/bin/alnkcat_helper" daemon >/dev/null 2>&1 &

# mark the service as started
touch "$MODDIR/.daemon_running"