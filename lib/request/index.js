const fs = require('fs');
const { spawn } = require('child_process');
const proxy = require('../proxy');

function Response (obj, sourceUrl) {
    this.request = obj; // < deprecated
    this.status = obj.status;
    this.content = obj.responseText;
    this.json = function () {
        return JSON.parse(this.content);
    }
    this.url = sourceUrl;
    return this;
}

/**
 * Smappi CL Request Wrapper
 *
 * @param {string} method - GET or POST
 * @param {object} args - Contain {url, data, options, headers}
 */
function Request (method, args) {
    if (!args.url) throw 'URL undefined!';
    args.data = args.data || {}; // for POST/PUT
    args.params = args.params || {}; // for GET
    args.headers = args.headers || {};
    args.options = args.options || {};
    args.proxy = proxy.currentHref();
    args.method = method;
    if (!args.options.async) { // Synchronous
        var contentFile = ".smappi-request-content-" + process.pid;
        var syncFile = ".smappi-request-sync-" + process.pid;
        fs.writeFileSync(syncFile, "", "utf8");
        // The async request the other Node process executes
        // Start the other Node Process, executing this string
        console.debug(process.argv[0], __dirname + '/worker.js', process.pid, "'" + JSON.stringify(args) + "'");
        var syncProc = spawn(process.argv[0], [
            __dirname + '/worker.js',
            process.pid,
            JSON.stringify(args)
        ]);
        while (fs.existsSync(syncFile)) {
            // Wait while the sync file is empty
        }
        var resp = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
        // Kill the child process once the file has data
        syncProc.stdin.end();
        // Remove the temporary file
        fs.unlinkSync(contentFile);
        if (resp.err) {
            throw (resp.err);
        } else {
            return new Response(resp, args.url);
        }
    } else {
        throw 'Temporary! Not Implemented Smappi CL Async Requests';
    }
}


function get (urlOrArgs, params, options, headers) {
    if (typeof(urlOrArgs) != 'object')
        urlOrArgs = {url: urlOrArgs, params, options, headers}
    return new Request('GET', urlOrArgs);
}

function post (urlOrArgs, data, options, headers) {
    if (typeof(urlOrArgs) != 'object')
        urlOrArgs = {url: urlOrArgs, data, options, headers}
    return new Request('POST', urlOrArgs);
}

module.exports = { Request, Response, get, post }
