# Mitro Password Manager

Mitro saves all your passwords, synchronizes them across all your devices, and lets you share them with others. It has extensions for Chrome, Firefox, and Safari, mobile apps for iOS and Android, and a server to perform the synchronization.

If you are a user, install it from the [Mitro web site](https://www.mitro.co/). If you have any questions, you can ask on the [mitro-dev@googlegroups.com](https://groups.google.com/forum/#!forum/mitro-dev) mailing list, or [send @MitroCo a tweet](https://www.twitter.com/MitroCo).


## Debian Server Setup Script 
The script is a compressed version of this [blogpost](https://www.hashtagsecurity.com/mitro-login-manager-on-premise-2/)

1. Copy the the script mitro-debian-setup.sh to /srv/ 
   - It will clone the repo by itself)
   - The script must be called "mitro-debian-setup.sh" or it will fail!

2. run the following commands as root
    cd /srv/
    chmod +x ./mitro-debian-setup.sh
    ./mitro-debian-setup.sh

3. Next, make sure to follow the instruction the script prints (namely, setting passwords for admin and mitro!)
    pwgen -s -n 12 -c 2
    passwd admin password
    passwd mitro password

4. Now you can start the mitro server
    screen -S mitro-server
    su - mitro
    cd /srv/mitro/mitro-core
    ant server

5. To leave the screen session without killing the process, type:
    [Ctrl]+[A] [D]

Tested on Debian Wheezy (7)

## Quick Start

1. Install dependencies (see [`browser-ext/README`](browser-ext/README.md), [`mitro-core/README`](mitro-core/README.md)) [node, npm, homebrew, java, ant]
2. Clone repository: `git clone https://github.com/mitro-co/mitro`
3. Install browser extension dependencies:

    ```
cd mitro
cd browser-ext/api
./build.sh
cd -
```
4. Run the regression tests to ensure your source tree works:

    ```
cd browser-ext/api/js/cli
./runtests.sh FAST && echo "SUCCESS"
```
5. Look for "SUCCESS" on the last line.
6. Build the browser extension:

    ```
cd -
cd browser-ext/login
make release
```
7. To build Firefox, use `make firefox` and to build Safari use `make safari`.

The extensions will be in the `browser-ext/login/build` directory.


### setup and run emailer

To send device verification emails, we use `emailer/emailer2.py`. Requirements: Postgres with the development libraries (Mac OS X: `brew install postgresql`). This script polls a table in the Postgres database to send email.

#### Configuration:

1. `cd emailer`
2. `./build.sh` to set up Python virtualenv with dependencies
3. To run: `build/venv/bin/python emailer2.py --enable_email --mandrill_api_key=api_key`
