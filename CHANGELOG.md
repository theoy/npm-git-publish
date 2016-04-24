# Changelog

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
