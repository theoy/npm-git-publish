import * as fs from 'fs';
import * as tar from 'tar';
import * as zlib from 'zlib';

export default function unpack(tarballPath: string, destinationPath: string) {
    const fileStream = fs.createReadStream(tarballPath),
        gunzipStream = zlib.createUnzip();

    return new Promise((resolve, reject) => {
        fileStream
            .on('error', reject) // file-level read error
            .pipe(gunzipStream)
            .on('error', reject) // gunzip error
            .pipe(createUntarStream(destinationPath))
            .on('error', reject) // untar error
            .on('close', resolve);
    });
}

const MIN_FILE_PERMS = 0o644, // 110 100 100 | rw- r-- r--
    MIN_DIR_PERMS = 0o755;    // 111 101 101 | rwx r-x r-x

interface IEntry {
    type: string,
    mode: number,
    props: {
        mode: number
    }
}

function createUntarStream(destinationPath: string) {
    return tar.Extract({
        type: 'Directory',
        path: destinationPath,
        strip: 1 /* npm pack nests tar images in a /package/ folder */
    }).on('entry', function ensureMinPermissions(entry: IEntry) {
        entry.mode = entry.mode || entry.props.mode;
        // ensure that permissions always include sensible minimum permissions
        entry.props.mode = entry.mode = entry.mode | (entry.type === 'Directory' ? MIN_DIR_PERMS : MIN_FILE_PERMS);
    });
}
