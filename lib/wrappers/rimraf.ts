import * as pify from 'pify';
import * as _rimraf from 'rimraf';

// Define an alternate options interface because the d.ts has a mistake where the last 4 props are marked as
// required properties rather than optional
export const _options : _rimraf.Options = undefined;
export interface Options {
    unlink?: typeof _options.unlink;
    chmod?: typeof _options.chmod;
    stat?: typeof _options.stat;
    lstat?: typeof _options.lstat;
    rmdir?: typeof _options.rmdir;
    readdir?: typeof _options.readdir;
    unlinkSync?: typeof _options.unlinkSync;
    chmodSync?: typeof _options.chmodSync;
    statSync?: typeof _options.statSync;
    lstatSync?: typeof _options.lstatSync;
    rmdirSync?: typeof _options.rmdirSync;
    readdirSync?: typeof _options.readdirSync;
    maxBusyTries?: number;
    emfileWait?: number;
    glob?: typeof _options.glob;
    disableGlob?: boolean;
}

// wrap real 'rimraf' using an ES6 export so that it can be stubbed in tests
const rimraf_p = pify(_rimraf);
export default function rimraf(pattern: string, options?: Options): Promise<void> {
    return rimraf_p(pattern, options);
}
