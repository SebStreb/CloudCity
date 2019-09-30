#!/bin/sh

# This file is specifically for CentOS or other RHEL derivatives
# Start by running conman itself and adjust for distro quirks

systemctl stop firewalld
systemctl start docker
setenforce Permissive
cd /root/conman
/root/conman/conman 1

