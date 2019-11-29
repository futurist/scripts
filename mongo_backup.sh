#!/bin/bash

MONGO_DATABASE=${1:-"test3"}
APP_NAME=${2:-${1:-"mongodb8080"}}

MONGO_HOST="127.0.0.1"
MONGO_PORT="27017"
TIMESTAMP=`date +%F-%H%M`
MONGODUMP_PATH="/usr/bin/mongodump"
BACKUPS_DIR="${3:-"/home/admin/backups/"}$APP_NAME"
BACKUP_NAME="$APP_NAME-$TIMESTAMP"
#=====================================================================
DAYSTORETAINBACKUP="15"
#=====================================================================

# mongo admin --eval "printjson(db.fsyncLock())"
# $MONGODUMP_PATH -h $MONGO_HOST:$MONGO_PORT -d $MONGO_DATABASE
# mongo admin --eval "printjson(db.fsyncUnlock())"

mkdir -p $BACKUPS_DIR
cd $BACKUPS_DIR
$MONGODUMP_PATH -d $MONGO_DATABASE -o $BACKUP_NAME
tar -zcvf $BACKUPS_DIR/$BACKUP_NAME.tgz $BACKUP_NAME
rm -rf $BACKUP_NAME

#=====================================================================
find $BACKUPS_DIR -type f -mtime +$DAYSTORETAINBACKUP -exec rm {} +
echo "--------------------------------------------"
echo "Database backup complete!"
#=====================================================================

# crontab -e
# */30 8-23 * * * /bin/bash /home/admin2/mongo_backup.sh
