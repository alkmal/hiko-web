#!/bin/sh
cd /var/www/vhosts/alkmal.com/vola.alkmal.com/hiko-web/backend || exit 1

if [ -f node.pid ]; then
  old_pid="$(cat node.pid 2>/dev/null)"
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    kill "$old_pid" 2>/dev/null || true
    sleep 1
  fi
fi

if [ "$(id -u)" = "0" ]; then
  chown -R hr_alkmal.com:psacln /var/www/vhosts/alkmal.com/vola.alkmal.com/hiko-web/backend/node-release.out /var/www/vhosts/alkmal.com/vola.alkmal.com/hiko-web/backend/node.pid 2>/dev/null || true
  exec su -s /bin/sh hr_alkmal.com -c "/var/www/vhosts/alkmal.com/vola.alkmal.com/hiko-web/backend/start-vola.sh"
fi

PORT=5010 NODE_ENV=production setsid /opt/plesk/node/25/bin/node /var/www/vhosts/alkmal.com/vola.alkmal.com/hiko-web/backend/index.js > node-release.out 2>&1 < /dev/null &
echo $! > node.pid
sleep 5

if kill -0 "$(cat node.pid)" 2>/dev/null; then
  echo "node started $(cat node.pid)"
else
  echo "node failed"
fi

tail -n 120 node-release.out
