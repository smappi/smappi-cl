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
function Request (method, args, attempts, proxyCondition) {
    // constraint
    attempts = attempts || 0;
    if (attempts > 10)
        throw {message: `Max attempts exceed (10 total) for request ${args.url}`, code: 507}
    // workflow
    if (!args.url) throw {message: 'URL undefined!'};
    args.data = args.data || {}; // for POST/PUT
    args.params = args.params || {}; // for GET
    args.headers = args.headers || {};
    args.options = args.options || {};
    if (args.options.proxy !== false && proxyCondition && !proxy.isActive()) {
        // if not disable proxy (for internal request, see proxy.js)
        // and there proxyCondition
        // and not active proxy
        proxy.next(); // then activate proxy if used withProxy!
    }
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
            if (Object.keys(resp.err).length) {
                throw resp.err;
            } else if (args.proxy && resp.ctx == 'request') {
                // if use proxy and request is broken, then turn next
                proxy.next({skipCurrent: true});
                return new Request(method, args, attempts + 1);
            } else if (resp.message) {
                throw resp;
            } else {
                throw {message: 'Problem with connection in smappi-cl/lib/request'};
            }
        } else {
            if (!proxyCondition || proxyCondition(resp.responseText)) {
                // If not proxyCondition or proxyCondition is success
                // return Response
                return new Response(resp, args.url);
            } else {
                // Otherwise retry again
                return new Request(method, args, attempts + 1);
            }
        }
    } else {
        throw 'Temporary! Not Implemented Smappi CL Async Requests';
    }
}


function get (urlOrArgs, params, options, headers) {
    if (typeof(urlOrArgs) != 'object')
        urlOrArgs = {url: urlOrArgs, params, options, headers}
    return new Request('GET', urlOrArgs, 0, this.proxyCondition);
}

function post (urlOrArgs, data, options, headers) {
    if (typeof(urlOrArgs) != 'object')
        urlOrArgs = {url: urlOrArgs, data, options, headers}
    return new Request('POST', urlOrArgs, 0, this.proxyCondition);
}

function withProxy (condition) {
    this.proxyCondition = condition;
    return this;
}

module.exports = { Request, Response, withProxy, get, post }
