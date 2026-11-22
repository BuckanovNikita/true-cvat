# Cut a release

Owner's word only, from published `develop`. `STAGE` is one more than the highest of `git tag -l 'v2.82.0.*'` (first on a new upstream release: `${TARGET}.1`). Run as one command; the `&&` chain stops at the first failure, so nothing is tagged or pushed:

```bash
STAGE=v2.82.0.N; WHAT="what the stage delivers"
git fetch origin &&
! git rev-parse -q --verify "refs/tags/${STAGE}" >/dev/null &&        # the stage tag is new
! git merge-base --is-ancestor origin/develop origin/release &&      # there is something to cut
[ -z "$(git status --short --untracked-files=no)" ] &&               # the block overwrites the working tree
git switch -C release origin/release &&
git merge --no-ff --no-commit -s ours origin/develop &&              # develop becomes the second parent
git read-tree -u --reset origin/develop &&                           # take develop's tree exactly
git rm -r -q -f --ignore-unmatch local &&                            # -f: the files are staged
git commit -m "release: ${STAGE}, ${WHAT}" &&
[ "$(git branch --show-current)" = release ] &&
[ "$(git rev-parse HEAD^1)" = "$(git rev-parse origin/release)" ] &&
[ "$(git rev-parse HEAD^2)" = "$(git rev-parse origin/develop)" ] &&
[ -z "$(git diff --name-only origin/develop HEAD | grep -v '^local/')" ] &&
[ -z "$(git ls-tree --name-only HEAD -- local)" ] &&
git tag -a "${STAGE}" -m "Stage ${STAGE##*.}: ${WHAT}" &&
git push --atomic origin release "${STAGE}"
```

A stop at the second or third check means there is nothing to cut. If it stops after the merge began: `git merge --abort`, plus `git tag -d "${STAGE}"` if the tag was made but not pushed, then rerun.
