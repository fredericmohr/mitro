#!/bin/bash
start=$(date +%s)
user=$(whoami)
if [ "$user" == "root" ]
then
  echo "[*] This setup script installs the Mitro server daemon on Debian 7 Wheezy"
  osvers=$(cat /etc/debian_version)
  echo "[*] Your currently running $osvers"
  echo "[!] Script must run as root or with sudo privileges"
  echo "[!] Note that this script assumes that everything works fine - there is not exception handling!"
  echo -e ""
  
  echo "[*] Updating operating system... this might take a while!"
  apt-get update >> mitro_debian_setup.log  2>&1
  apt-get upgrade -y >> mitro_debian_setup.log  2>&1
  echo "[*] Installing required packages"
  apt-get install pwgen git sudo screen postgresql postgresql-contrib postgresql-pltcl-9.1 ant make g++ curl unzip openjdk-7-jdk libpostgresql-jdbc-java -y >> mitro_debian_setup.log 2>&1
  echo "[*] Adding NodeJS to sources.list"
  curl -sL https://deb.nodesource.com/setup | bash - >> mitro_debian_setup.log 2>&1
  echo "[*] Installing NodeJS"
  apt-get install nodejs -y >> mitro_debian_setup.log 2>&1
  
  echo "[*] creating required links"
  ln -s /usr/lib/postgresql/9.1/bin/initdb  /usr/bin/initdb
  rm /etc/alternatives/java
  ln -s /usr/lib/jvm/java-7-openjdk-amd64/jre/bin/java /etc/alternatives/java
  ln -s /usr/lib/postgresql/9.1/bin/pg_ctl /usr/bin/pg_ctl
  
  
  echo "[*] Stopping all PostgreSQL instances"
  /etc/init.d/postgresql stop
  killall -9 postgres
  if [ -f /srv/mitro/mitro-core/build/postgres/postmaster.pid ]
  then
    rm /srv/mitro/mitro-core/build/postgres/postmaster.pid
  fi

  
  
  echo "[*] Creating users 'admin' and 'mitro'"
  adduser admin --disabled-password --gecos GECOS
  adduser mitro --disabled-password --gecos GECOS
  useradd -g mitro admin

  echo "[*] Setting sudo permissions for admin"
  echo "# admin user to manage mitro server" >> /etc/sudoers.d/mitro
  echo "admin    ALL=(ALL:ALL) ALL" >> /etc/sudoers.d/mitro
  chmod 440 /etc/sudoers.d/mitro

  echo "[*] Fetching mitro from github"
  cd /srv/
  git clone https://github.com/mitro-co/mitro.git
  mkdir -p /srv/mitro/mitro-core/build/postgres

  echo "[*] Setting required user permissions"
  chown -R mitro:mitro /var/run/postgresql/
  chown -R mitro:mitro /srv/mitro/
  chmod -R 750 /srv/mitro
  chmod -R 700 /srv/mitro/mitro-core/build/postgres

  echo ""
  #Now, start the script as user mitro and setup the rest...
  sudo -u mitro /srv/mitro-debian-setup.sh

elif [ "$user" == "mitro" ]
then
  echo "[*] Initializing postgres environment"
  cd /srv/mitro/mitro-core/

  /usr/lib/postgresql/9.1/bin/initdb --pgdata=/srv/mitro/mitro-core/build/postgres -E 'UTF-8' --lc-collate='en_US.UTF-8' --lc-ctype='en_US.UTF-8'
  sleep 5
  echo "[*] Starting the database daemon"
  /usr/lib/postgresql/9.1/bin/pg_ctl -D /srv/mitro/mitro-core/build/postgres start
  sleep 5
  echo "[*] Looking for PostgreSQL... (should be seen in output!) "
  netstat -antp |grep postgres
  echo ""
  echo "[*] If you can't see postgres running, you need to kill the old process first"
  echo " [-] root: killall -9 postgres"
  echo " [-] root: rm /srv/mitro/mitro-core/build/postgres/postmaster.pid"
  echo "[*] Creating postgres database - if this fails, you need to check if postgres runs!"
  echo ""
  createdb -O mitro mitro
  echo -e "\n"
  echo "[*] While running the build tests, you can ignore the following errors for now:"
  echo " [-] groups_name_scope: DB is not Postgres"
  echo " [-] group_secret_svs_group: DB is not Postgres"
  echo " [-] TwoFactorAuth: re-setting secrets;"
  echo " [-] missing or invalid email: "

  echo "[*] Starting tests... this might take a while"
  ant test |tee -a mitro_debian_setup.log |grep "WARN\|ERROR\|BUILD"

  echo ""
  echo "[!] mitro doesn't have sudo rights and it should stay that way."
  echo "[!] Use admin if you need to perform admin tasks and mitro if you want to restart the postgres or mitro daemon"
  echo "[!] please run 'passwd admin' and change the password"
  echo "[!] please run 'passwd mitro' and change the password"
  echo "[*] You can create random passwords with 'pwgen -s -n 12 -c 1'"
  echo ""
  cd /srv/mitro/mitro-core/
  echo "[*] To start the server cd to /srv/mitro/mitro-core and run 'ant server' as user mitro (su - mitro)"
  end=$(date +%s)
  elapsed=$(( $end - $start ))
  echo "Setup script took: $elapsed sec"
else
  echo "[!] Error: Script must either be run as root/sudo or mitro user!"
fi
