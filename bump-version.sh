#!/usr/bin/env bash

action=$1

if [ "$action" != "patch" ] && [ "$action" != "minor" ] && [ "$action" != "major" ]; then
    echo 'You have to specify how you want to bump the version, i.e.'
    echo
    printf "\tbump-version.sh patch|minor|major\n"
    exit
fi

new_version=$(npm version $action --git-tag-version=false)
cd src-tauri
cargo release version -x --no-confirm -q $action
jq --arg version "${new_version:1}" '.version |= $version' tauri.conf.json | sponge tauri.conf.json
npx --yes prettier --write tauri.conf.json
git commit -am "$new_version"
git tag $new_version
git push
git push origin $new_version