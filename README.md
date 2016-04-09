# npm-git-publish [![Stories in Ready][board-badge]][waffle-board]

> Dev tool to publish an NPM package to a remote Git repository, instead of a
registry or CDN of tarballs. Useful alternative for private packages.

NPM, for eons ([circa 2012][npm-doc-update-git-support]), has supported the ability to install from a Git
URL. Installing from a Git URL has many advantages, but as of yet NPM does
not include the ability to publish to a Git URL/feed out of the box.

However, there are many reasons why you may wish to use it:
* Supports distribution of private packages without running a private registry
  server (or paying someone to do so)
* Supports distribution of private packages using network or auth-based security
  (i.e. on-premise or cloud-based)
* Supports Git URL-based security/authentication mechanisms
* Has a superior versioning representation compared to CDNs/raw tarballs
* Decentralized point of failure, set up your own network of Git mirrors as you wish

Note, the best experience for NPM packages is still with an official registry
server. You can find out more about user experience differences for packages
installed from Git on the official [NPM Git Roadmap Page
](https://github.com/npm/npm/wiki/Roadmap-area-of-focus:-git).

## Design
Currently, for simplicity this package is available only in API form. As an API
it is currently designed in the following way:

* **Asynchronous ES6 API**: Also very Promise-y :). Uses whatever Promise
  implementation is built-in to Node or globally polyfilled. Also does exports
  in ES6-style, with its default function being the ES6 default export.

* **Attached Console**: Is designed to run as part of a console UX, to help
  satisfy potential auth prompts interactively during clone and push. To run
  non-interactively, ensure that you have configured a [credential helper
  ](https://www.git-scm.com/docs/gitcredentials).

* **Intermediate Pack:** In order to provide better compatibility/parity with
  conventional publishing, `npm-git-publish` actually invokes the official
  `npm pack` to create an intermediate tarball and then uses its contents to
  populate the Git-based release.

* **Temporary local clone**: In order to simplify Git-integration, the
  implementation creates a shallow clone in your local file system (you provide
  the path). Computing all of this virtually in-memory would be faster, but
  could not find readily-available implementations.

* **External tools**: Does not reference an implementation of Git or NPM. This
  makes `npm install` of this package faster, but you will need to ensure
  compatible versions are locatable on your `$PATH`.

## Install

Typically you would use this package as a library, as part of your dev scripts.

```
npm install -D npm-git-publish
```

## API

```es6
import publish from 'npm-git-publish';

publish(packageDir,
        gitRemoteUrl,
        commitText,
        tagName,
        tagMessageText,
        tempDirectory,
        packageInfo)
    .then(didPublish => {
        // respond to whether publishing occurred
        // (e.g. print something to stdout)
    });
```

## parameters

* **packageDir** (string)

    The source directory for your package (contains the package.json)

* **gitRemoteUrl** (string)

    The remote Git endpoint, formatted in a way consumable by `git clone`.

* **commitText** (string)

    Text for the commit, if publishing occurs (if the package has any
    differences from the last release pushed to the provided Git URL)

* **tagName** (string)

    String value to use for the tag name, if publishing occurs (if the package
    has any differences from the last release pushed to the provided Git URL)

* **tagMessageText** (string)

    Message text to use for creating the annotated tag, if publishing occurs
    (if the package has any differences from the last release pushed to the
    provided Git URL)

* **tempDirectory** (string)

    Path to a temporary working directory _**unique to this invocation**_.
    As a first step, the entire directory is removed, and intermediate files
    such as the cloned repository, pack file, and commit text file are written
    here. If working on Windows, please ensure that sufficient path length
    is reserved.

* **packageInfo** (object)

    The `package.json` from `packageDir`, read into a Javascript object.
    


[npm-doc-update-git-support]: https://github.com/npm/npm/commit/3abab66be0c75d03ad6bbb089e0d3339d8525f44
[board-badge]: https://badge.waffle.io/theoy/npm-git-publish.png?label=ready&title=Ready
[waffle-board]: https://waffle.io/theoy/npm-git-publish