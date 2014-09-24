#Mitro Mail Service
Mitro sends mails via SMTP. You can either use your own SMTP server or create an account at a cloud mail provider such as mandrill or aws.

## AWS and Mandrill
For now, only smtp is supported but the use of AWS SES or Mandrill APIs might be added later.

## Setup 
On Debian Wheezy, you can setup the mail service like this: (run as root)
**Note:** This assumes you have mitro installed in /srv/mitro/

    apt-get install python-virtualenv  postgresql-server-dev-9.1 python-dev python-sqlalchemy python-tornado
    pip install mandrill
    cd /srv/mitro/mitro-mail/
    ./build.sh

## Run the mailer
To run the mailer, you have currently two options.
Either put your SMTP connection settings in mitro/mitro.cfg and run the script as user "mitro"
Note: You need to use /srv/mitro/mitro-mail/build/venv/bin/python instead of /usr/bin/python for this to work!

    su - mitro
    cd /srv/mitro/mitro-mail/
    ./build/venv/bin/python emailer2.py --enable-email    

If you leave out --enable-email, the script will run in dry-mode!

The other option is to ignore the mitro.cfg SMTP setting by adding your settings as commandline parameters. This is good for testing purposes.

    su - mitro
    cd /srv/mitro/mitro-mail/
    ./build/venv/bin/python emailer2.py --enable_email --smtp_host=yoursmtpserver.local --smtp_password= --smtp_port=25 --smtp_user=

**Warning:** smtp_user and smtp_password have been left out. This is the syntax you need to use whenever you want it to be emtpy. Do not use smtp_user="" as it won't work! Also note, that every option that isn't define here is pulled from the config, and that --smtp_host is the trigger to actually load the cmd-line options.

Meaning that this would be ignored and all options will be loaded from the config file (for now...)

    ./build/venv/bin/python emailer2.py --enable_email --smtp_password=milk --smtp_port=25 --smtp_user=thedude

