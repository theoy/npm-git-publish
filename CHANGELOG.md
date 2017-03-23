# Changelog

## 0.2.4-beta
Bug fix: Using the `--force` option to push a moved branch (version tag) to remote, as
required under certain circumstances.

## 0.2.3-beta
Support extra GIT tags (actually branches, to be better movable) to set for the
publication commit. These names can then be used as alternate version
reference(s) on consumption side.

## 0.2.2-beta
Support type definitions (d.ts files) in published package

## 0.2.1-beta
Fix #19 - package.json prepublish scripts can cause publish to fail

## 0.2.0-beta
* Support for optional parameters / default parameter behaviour
* Support for new promise result (object with `conclusion` property)
* Support for optional prepublish callback

## 0.1.0-beta
* Supports basic scenarios
    * Takes a package directory and Git URL and publishes to it
      in a way that matches `npm publish` or `npm pack`.
    * Supports creating a git tag to mark the release
    * Currently you provide all the information
      (see API docs in README), doesn't decide anything for you.
* Simplest possible implementation for current design
    * All required parameters
