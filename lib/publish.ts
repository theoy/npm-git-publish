import { execSync, exec as _exec } from 'child_process';
import * as path from 'path';
import * as pify from 'pify';
import * as fs from 'fs';

import mkdirp from './wrappers/mkdirp'
import rimraf from './wrappers/rimraf';
import unpack from './unpack';

export interface PackageInfo {
    name: string;
    version: string
}

export interface Options {
    commitText?: string;
    tagName?: string;
    extraBranchNames?: string[];
    tagMessageText?: string;
    prepublishCallback?: (tempPackagePath: string) => Promise<boolean>;
    tempDir?: string;
    originalPackageInfo?: PackageInfo;
}

interface Params {
    commitTextOp: Promise<string>;
    mainTagNameOp: Promise<string>;
    extraBranchNames?: string[];
    tagMessageTextOp: Promise<string>;
    prepublishCallback: (tempPackagePath: string) => Promise<boolean>;
    tempDir: string;
    originalPackageInfo: PackageInfo;
}

export interface Result {
    conclusion: publish.Conclusions
}

export default publish;
// new overload
export function publish(packageDir: string,
    gitRemoteUrl: string,
    options?: Options): Promise<Result>;

// old deprecated overload
export function publish(packageDir: string,
    gitRemoteUrl: string,
    commitText: string,
    tagName: string,
    tagMessageText: string,
    tempDir: string,
    packageInfo: PackageInfo): Promise<boolean>;

export function publish(packageDir: string,
    gitRemoteUrl: string,
    options?: string | Options,
    tagName?: string,
    tagMessageText?: string,
    tempDir?: string,
    packageInfo?: PackageInfo): Promise<boolean | Result> {

    if (typeof options === 'string') {
        // using the deprecated overload
        return doPublish(packageDir, gitRemoteUrl, {
            commitTextOp: Promise.resolve(options),
            mainTagNameOp: Promise.resolve(tagName),
            tagMessageTextOp: Promise.resolve(tagMessageText),
            prepublishCallback: path => Promise.resolve(true),
            tempDir: tempDir,
            originalPackageInfo: packageInfo
        })
            .then(result => result.conclusion === publish.PUSHED);
    } else {
        // otherwise assume they want the new overload
        return createParams(packageDir, gitRemoteUrl, options)
            .then(params => doPublish(packageDir, gitRemoteUrl, params));
    }
}

export namespace publish {
    export const PUSHED : 'pushed' = 'pushed',
        SKIPPED : 'skipped' = 'skipped',
        CANCELLED : 'cancelled' = 'cancelled';
    export type Conclusions = typeof PUSHED | typeof SKIPPED | typeof CANCELLED;
}

function doPublish(packageDir: string, gitRemoteUrl: string, params: Params): Promise<Result> {
    const writeFile = pify(fs.writeFile),
        gitRepoDir = path.join(params.tempDir, 'repo'),
        packDir = path.join(params.tempDir, 'pack'),
        commitTextPath = path.join(params.tempDir, 'commitMessage.txt'),
        tagTextPath = path.join(params.tempDir, 'tagMessage.txt'),
        cleanupOperations: Promise<any>[] = [];

    // launch setup operations
    const initialCleanDone = rimraf(params.tempDir, { glob: false });
    const directoryReady = initialCleanDone.then(() => mkdirp(packDir));
    const commitTextWritten = Promise.all([params.commitTextOp, directoryReady])
        .then(([commitText]) => writeFile(commitTextPath, commitText));
    const tagTextWritten = Promise.all([params.tagMessageTextOp, directoryReady])
        .then(([tagMessageText]) => writeFile(tagTextPath, tagMessageText));

    // simultaneously ask NPM to pack up the package dir and create a clone of the remote URL
    const tarballCreated = packPackageIntoTarball();
    const doneCloning = cloneRemoteToTempRepo();

    return replaceRepoWithPackContents()
        .then(stageAllRepoChanges)
        .then(() => params.prepublishCallback(gitRepoDir))
        .then(shouldContinue =>
            shouldContinue ? finishReleaseAndReturnResult() : cleanUpAndReturnChanged(publish.CANCELLED));

    function finishReleaseAndReturnResult() {
        return stageAllRepoChanges()
            .then(queryRepoStatus)
            .then(hasChanges => hasChanges ? commitChanges() : Promise.resolve())
            .then(tagLastCommit)
            .then(pushDefaultBranch)
            .then(() => cleanUpAndReturnChanged(publish.PUSHED));
    }

    function cleanUpAndReturnChanged(conclusion: publish.Conclusions) {
        cleanupOperations.push(rimraf(params.tempDir, { glob: false }));
        return Promise.all(cleanupOperations).then(() => ({ conclusion: conclusion }));
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // LOCAL HELPER FUNCTIONS

    function packPackageIntoTarball() {
        return directoryReady
            .then(() => exec(`npm pack "${packageDir}"`, { cwd: packDir }))
            .then(() => {
                // pack succeeded! Schedule a cleanup and return the full path
                cleanupOperations.push(exec(`npm cache clean ${params.originalPackageInfo.name}@${params.originalPackageInfo.version}`));
                return path.join(packDir, computeTarballName());
            });
    }

    function computeTarballName() {
        let name = params.originalPackageInfo.name;
        if (name[0] === '@') {
            // in generating tarball names, npm special-cases scoped packages.
            name = name.substr(1).replace(/\//g, '-');
        }
        return `${name}-${params.originalPackageInfo.version}.tgz`;
    }

    function cloneRemoteToTempRepo() {
        return initialCleanDone.then(() => {
            execSync(`git clone --quiet --depth 1 ${gitRemoteUrl} "${gitRepoDir}"`, { stdio: 'inherit' });
        });
    }

    function replaceRepoWithPackContents() {
        // in order to allow for the new release to overwrite the old one (including possibly removing/renaming files),
        // we remove everything that was in the repo before. To do this, use an exclusionary glob.
        const cleanPattern = path.join(gitRepoDir, '!(.git)');
        // tell glob to treat the leading '.' in filename (e.g. Linux/Mac hidden files) as a normal character.
        // this is necessary so that we can successfully delete files that begin with '.'
        const cleanOptions = { glob: { dot: true } };

        const doneCleaning = doneCloning.then(() => rimraf(cleanPattern, cleanOptions));

        return Promise.all<any>([tarballCreated, doneCleaning])
            .then(([tarballPath] : [string]) => unpack(tarballPath, gitRepoDir));
    }

    function stageAllRepoChanges() {
        return exec(`git add --all`, { cwd: gitRepoDir });
    }

    function queryRepoStatus() {
        return exec(`git status --porcelain`, { cwd: gitRepoDir })
            .then((statusOutput) => {
                return statusOutput.trim().length !== 0;
            });
    }

    function commitChanges() {
        const commitCommandText = `git commit --file="${commitTextPath}" --allow-empty-message --no-verify`;
        return commitTextWritten.then(() => exec(commitCommandText, { cwd: gitRepoDir }));
    }

    function tagLastCommit() {
        return Promise.all([params.mainTagNameOp, tagTextWritten])
            .then(([tagName]) => {
                return exec(`git tag -a --file="${tagTextPath}" "${tagName}"`, { cwd: gitRepoDir })
                .then(() => {
                    let promises: Promise<string>[] = [];
                    (params.extraBranchNames || []).forEach((extraBranchName) => {
                        promises.push(exec(
                            `git branch -f "${extraBranchName}" "${tagName}"`,
                            { cwd: gitRepoDir }
                        ));
                    });

                    return Promise.all(promises);
                });
            });
    }

    function pushDefaultBranch() {
        const extraBranchNames = (params.extraBranchNames || []).join(' ');
        execSync(
            `git push --follow-tags --force origin HEAD ${extraBranchNames}`,
            { cwd: gitRepoDir, stdio: 'inherit' }
        );
    }
}

function readPkg(packageDir: string) : Promise<PackageInfo> {
    return require('read-pkg')(packageDir);
}

function createParams(packageDir: string, gitRemoteUrl: string, options?: Options) : Promise<Params> {
    options = options || {};

    // eagerly copy the provided options because we are about to do asynchronous work
    const requestedCommitText = options.commitText,
        requestedPrepublishCallback = options.prepublishCallback,
        requestedTagName = options.tagName,
        requestedTagMessageText = options.tagMessageText,
        providedTempDirectory = options.tempDir;

    if (options.originalPackageInfo) {
        return Promise.resolve(provideRemainingDefaults(options.originalPackageInfo));
    } else {
        return readPkg(packageDir).then(provideRemainingDefaults);
    }

    function provideRemainingDefaults(originalPackageInfo: PackageInfo) : Params {
        let prepublishCallback : (tempPackagePath: string) => Promise<boolean>;
        let versionOp : Promise<string>;
        if (!requestedPrepublishCallback) {
            // default to no-op transform that just returns true to 'continue'
            prepublishCallback = path => Promise.resolve(true);
            versionOp = Promise.resolve(originalPackageInfo.version);
        } else {
            let callbackOp : Promise<boolean> = null;
            let setVersionOp : (versionOp: Promise<string>) => void;
            versionOp = new Promise(resolver => {
                setVersionOp = resolver;
            });
            prepublishCallback = (tempPackagePath) => {
                if (callbackOp === null) {
                    callbackOp = requestedPrepublishCallback(tempPackagePath);
                    // now that we have a promise to listen on, observe it and re-read the version from
                    // package.json after it finishes (if the callback promise didn't result in error)
                    const readUpdatedVersionOp = callbackOp
                        .then(() => readPkg(tempPackagePath))
                        .then(updatedPackageInfo => updatedPackageInfo.version);
                    setVersionOp(readUpdatedVersionOp);
                }
                return callbackOp;
            }
        }

        const commitTextOp = requestedCommitText ? Promise.resolve(requestedCommitText) :
                versionOp.then(version => `release: version ${version}`);

        return {
            commitTextOp: commitTextOp,
            tagMessageTextOp: requestedTagMessageText ? Promise.resolve(requestedTagMessageText) : commitTextOp,
            mainTagNameOp: requestedTagName ? Promise.resolve(requestedTagName) : versionOp.then(version => `v${version}`),
            extraBranchNames: options.extraBranchNames,
            prepublishCallback: prepublishCallback,
            tempDir: providedTempDirectory || require('unique-temp-dir')() as string,
            originalPackageInfo: originalPackageInfo
        };
    }
}

// this has a compatible signature to promisified child_process.exec()
// the difference is that it prints out stdout/stderr if the command fails
function exec(command: string, options?: { cwd: string }) {
    return new Promise<string>((resolve, reject) => {
        _exec(command, options, (error, stdout, stderr) => {
            if (error) {
                if (stdout) {
                    console.log(stdout);
                }
                if (stderr) {
                    console.error(stderr);
                }
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}
