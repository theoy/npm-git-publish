# npm-git-publish [![Stories in Ready][board-badge]][waffle-board]

> Share/publish private packages using Git remotes!

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

```
import publish from 'npm-git-publish';

publish(packageDir, gitRemoteUrl [, options] )
    .then(result => {
        // respond to whether publishing occurred
        // (e.g. print something to stdout)
        if (result.conclusion === publish.PUSHED) {

        } else if (result.conclusion === publish.SKIPPED) {

        } else if (result.conclusion === publish.CANCELLED) {

        }
    });
```

## parameters

* **packageDir** (string)

    The source directory for your package (contains the package.json)

* **gitRemoteUrl** (string)

    The remote Git endpoint, formatted in a way consumable by `git clone`.

* **options** (object)

    Optional property bag of custom options, see below.

## options

* **commitText** (string)

    Default: `` `release: version ${version}` `` (version from package.json)

    Text for the commit, if the (possibly post-transformed) package has any
    differences with the last commit at the default (HEAD) branch. The version
    used to generate the default text will be read after any transforms are
    run, if provided.

* **tagName** (string)

    Default: `` `v${version}` `` (version from package.json)

    String value to use for the tag name. The version used to generate the
    default tag name will be read after any transforms are run, if provided.

* **tagMessageText** (string)

    Default: the same value as `commitText` (custom, if provided, else the
    same default text)

    Message text to use for creating the annotated tag, if publishing occurs
    (if the package has any differences from the last release pushed to the
    provided Git URL)

* **prepublishCallback** ( `(tempPackagePath: string) => Promise<boolean>` )

    A custom callback function that can inspect/transform the final package
    contents before it is committed/tagged/pushed. It is provided the path to
    the generated temporary directory with the package contents on disk.
    
    The callback should return a promise that resolves to a boolean,
    signalling whether publishing should continue. If the promise result is
    falsy, then publishing is cancelled and the promise resolves in a
    non-error state with the conclusion equal to the `CANCELLED` property.
    
    If the promise resolves to an error, or an error occurs on invocation,
    then the error cascades and causes the publish operation to result
    in a promise that is in the terminal error state.

    If a callback is provided for this option, and the default behaviour
    is requested to generate the tag name or commit text based on the
    `version`, then those operations will be deferred until after the
    callback concludes in order to allow for the callback to edit the
    `package.json` version if desired.

* **tempDirectory** (string)

    Default: a generated unique directory from `os.tmpdir()`

    Path to a temporary working directory _**unique to this invocation**_.
    As a first step, the entire directory is removed, and intermediate files
    such as the cloned repository, pack file, and commit text file are written
    here. If working on Windows, please ensure that sufficient path length
    is reserved.

* **originalPackageInfo** (object)

    Default: the current contents of your `package.json`

    The `package.json` from `packageDir`, read into a Javascript object, if
    you happened to already have it handy. Needed to remove the temporary
    tarball from your npm cache, but the library can read it for you if
    you didn't already have it, or are unsure if the contents no longer match
    the state of the `package.json` on disk.



[npm-doc-update-git-support]: https://github.com/npm/npm/commit/3abab66be0c75d03ad6bbb089e0d3339d8525f44
[board-badge]: https://badge.waffle.io/theoy/npm-git-publish.png?label=ready&title=Ready
[waffle-board]: https://waffle.io/theoy/npm-git-publish
