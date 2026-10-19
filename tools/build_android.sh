#!/bin/bash
# Signed release APK + AAB of Марий мут -> release/mari-wordle.apk, release/mari-wordle.aab (package ru.pirogovlab.mariwordle)
# Signed with the SAME release key as Мут тӱня (/workspace/mari-wow/release/keys/, alias from keystore.properties).
set -euo pipefail
cd /workspace/mari-wordle
python3 tools/build_release.py android
export ANDROID_HOME=/opt/android-sdk JAVA_HOME=${JAVA_HOME:-/opt/jdk17}
(cd android && /opt/gradle-8.13/bin/gradle --no-daemon -q clean assembleRelease bundleRelease)
cp android/app/build/outputs/apk/release/app-release.apk release/mari-wordle.apk
cp android/app/build/outputs/bundle/release/app-release.aab release/mari-wordle.aab
BT=/opt/android-sdk/build-tools/36.0.0
$BT/apksigner verify --print-certs release/mari-wordle.apk | head -3 && echo "apk signature OK"
$BT/aapt2 dump badging release/mari-wordle.apk | grep -E "^package|minSdk|targetSdk|application-label:"
grep -o 'demo-[a-z]*-yandex\|R-M-[0-9]*-[0-9]*' android/app/src/main/res/values/ads.xml | head -3 | tr '\n' ' '; echo
ls -la release/mari-wordle.apk release/mari-wordle.aab
