#!/bin/bash
# usage: all.sh <html> <outdir> [extra env]
H=$1; O=$2; rm -rf $O; mkdir -p $O
node run.js $H $O '^(quests|form[0-4]|edit[0-1]|denH|daily|rfx_.*|opening|collection)$' > $O/log1 2>&1 &
node run.js $H $O '^(progress|inventory|shop|market|settings|den|denL|form|form[5-9]|edit[2-3]|widgets|arrange|openall)$' > $O/log2 2>&1 &
wait; cat $O/log*
