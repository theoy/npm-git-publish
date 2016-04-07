import { execSync, exec as _exec } from 'child_process';
import * as path from 'path';
import * as pify from 'pify';
import * as fs from 'fs';

import mkdirp from './wrappers/mkdirp'
import rimraf from './wrappers/rimraf';
import unpack from './unpack';

type PackageInfo = { name: string, version: string };

export default function publish(packageDir: string,
                                gitRemoteUrl: string,
                                commitText: string,
                                tagName: string,
                                tagMessageText: string,
                                tempDir: string,
                                packageInfo: PackageInfo): Promise<boolean> {

    const writeFile = pify(fs.writeFile),
        gitRepoDir = path.join(tempDir, 'repo'),
        packDir = path.join(tempDir, 'pack'),
        commitTextPath = path.join(tempDir, 'commitMessage.txt'),
        tagTextPath = path.join(tempDir, 'tagMessage.txt'),
        cleanupOperations: Promise<any>[] = [];

    // launch setup operations
    const initialCleanDone = rimraf(tempDir, { glob: false });
    const directoryReady = initialCleanDone.then(() => mkdirp(packDir));
    const commitTextWritten = directoryReady.then(() => writeFile(commitTextPath, commitText));
    const tagTextWritten = directoryReady.then(() => writeFile(tagTextPath, tagMessageText));

    // simultaneously ask NPM to pack up the package dir and create a clone of the remote URL
    const tarballCreated = packPackageIntoTarball();
    const doneCloning = cloneRemoteToTempRepo();

    // now do the update and push (if applicable)
    return replaceRepoWithPackContents()
        .then(stageAllRepoChanges)
        .then((hasChanges) => {
            if (!hasChanges) {
                return cleanUpAndReturnChanged();
            } else {
                return commitChanges()
                    .then(tagLastCommit)
                    .then(pushDefaultBranch)
                    .then(cleanUpAndReturnChanged);
            }

            function cleanUpAndReturnChanged() {
                cleanupOperations.push(rimraf(tempDir, { glob: false }));
                return Promise.all(cleanupOperations).then(() => hasChanges);
            }
        });

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // LOCAL HELPER FUNCTIONS

    function packPackageIntoTarball() {
        return directoryReady
            .then(() => exec('npm pack "' + packageDir + '"', { cwd: packDir }))
            .then((packCommandOutput) => {
                // pack succeeded! Schedule a cleanup and return the full path
                cleanupOperations.push(exec('npm cache clean ' + packageInfo.name + '@' + packageInfo.version));
                const packFileName = packCommandOutput.replace(/\r\n|\r|\n/g, '');
                return path.join(packDir, packFileName);
            });
    }

    function cloneRemoteToTempRepo() {
        return initialCleanDone.then(() => {
            execSync('git clone --quiet --depth 1 ' + gitRemoteUrl + ' "' + gitRepoDir + '"', { stdio: 'inherit' });
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

        return Promise.all<any>([ tarballCreated, doneCleaning ])
            .then((results: [string]) => unpack(results[ 0 ], gitRepoDir));
    }

    function stageAllRepoChanges() {
        return exec('git add --all', { cwd: gitRepoDir })
            .then(() => exec('git status --porcelain', { cwd: gitRepoDir }))
            .then((statusOutput) => {
                return statusOutput.trim().length !== 0;
            });
    }

    function commitChanges() {
        const commitCommandText = 'git commit --file="' + commitTextPath + '" --allow-empty-message --no-verify';
        return commitTextWritten.then(() => exec(commitCommandText, { cwd: gitRepoDir }));
    }

    function tagLastCommit() {
        const tagCommandText = 'git tag --annotate --file="'+tagTextPath+'" "'+tagName+'"';
        return tagTextWritten.then(() => exec(tagCommandText, { cwd: gitRepoDir }));
    }

    function pushDefaultBranch() {
        execSync('git push --follow-tags origin HEAD', { cwd: gitRepoDir, stdio: 'inherit' });
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
