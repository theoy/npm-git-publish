import * as pify from 'pify';
import * as _mkdirp from 'mkdirp';
import * as fs from 'fs';

// Define an alternate options interface because the d.ts has a mistake where the props are marked as
// required properties rather than optional
export interface Options {
    mode?: number,
    fs?: {
        mkdir: typeof fs.mkdir,
        stat: typeof fs.stat
    }
}

// wrap real 'mkdirp' using an ES6 export so that it can be stubbed in tests
const mkdirp_p = pify(_mkdirp);
export default function mkdirp(path: string, opts?: number | Options): Promise<string> {
    return mkdirp_p(path, opts);
}
