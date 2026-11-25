# Releases

How a version of Understory is cut, published and checked. The current release is
**0.1.0**; its history is in [CHANGELOG.md](../CHANGELOG.md).

## Version policy

The project stays in `0.x` while identities, transport and encryption are
simulated. A `1.0.0` would mean a node that authenticates people, carries signed
records between nodes and encrypts data at rest — none of which exists yet. A
minor bump is a release with new capability; a patch is a fix or a correction to
documentation and packaging.

`package.json` is the single source of truth. The interface reads the version
from it at build time (`__APP_VERSION__` in `vite.config.ts`), so no screen needs
editing when the version changes.

## Before tagging

```bash
npm ci                 # install exactly the lockfile
npm run typecheck
npm test
npm run build          # also checks that the route chunks stay within budget
```

Then check the built artifact the way a host serves it, not the way the dev
server does:

```bash
PREFIX=KnowledgeWeb node .tooling/serve-dist.mjs --check   # artifact is portable
PREFIX=KnowledgeWeb node .tooling/serve-dist.mjs           # or serve on :4190
# open http://127.0.0.1:4190/KnowledgeWeb/
```

Walk every route once, watch the console, and confirm the favicon and manifest
load. `PREFIX` is read from the environment because Git Bash rewrites a
POSIX-looking path argument into a Windows path.

Finally:

- Move the `[Unreleased]` entries in [CHANGELOG.md](../CHANGELOG.md) into the new
  version and date it.
- Bump the version without letting npm make the tag:

  ```bash
  npm version minor --no-git-tag-version   # or patch
  ```

- Commit the version and changelog together, then tag the commit.

## Tagging and notes

```bash
git tag -a v0.1.0 -m "Understory 0.1.0"
git push origin main --follow-tags
```

Create the release for the tag on GitHub (repository → Releases → Draft a new release)
and paste the matching changelog section as the body. Release notes repeat the
prototype boundary: simulated identities, no transport, no encryption at rest.

The tag is enough to rebuild the artifact exactly: `dist/` is versioned out of
git (`.gitignore`), and the build is deterministic apart from the content hashes
in asset names. A zip of `dist/` can be attached for people who do not want to
run Node.

## Publishing the build

The build has relative asset URLs and hash routing, so it runs from a domain root
or a subpath without rebuilding. CI publishes it: every push to `main` whose
checks pass is deployed by the `deploy` job in
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) to the GitHub Pages
project site <https://archaejon.github.io/KnowledgeWeb/>. The repository must be
public (or on a paid plan) and **Settings → Pages → Source** must be
**GitHub Actions**.

To publish by hand from another branch, run the workflow with
**Actions → CI → Run workflow**; only `main` deploys.

The project was first published on Codeberg (`archaejon.codeberg.page`); GitHub
is now the primary home.

## After publishing

- Open the published URL over HTTPS, not the local build. Check the console, the
  manifest and a hard reload on a deep link such as `#/knowledge/k-waterlog`.
- Confirm the node starts on sample data and that **Node settings → Export and
  backup** still produces a file.
- Check the version in the sidebar footer matches the tag.
- Record anything that only fails in the hosted environment in the release notes
  rather than leaving it implied.

## If a release is wrong

Publishing an earlier build again is the rollback: `git revert` the bad change
on `main` and push, or re-run an earlier successful CI run's deploy job.
Do not delete a tag that has been announced; publish a patch instead, so anyone
who already has the old build sees a correction rather than a missing version.
