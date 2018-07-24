const fs = require('fs'),
      { spawn } = require('child_process'),
      proxy = require('../proxy'),
      { logger } = require('../logging');

function Response (resp, sourceUrl) {
    this.request = resp; // < deprecated
    this.status = resp.status;
    this.content = resp.responseText;
    this.headers = resp.headers;
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
        throw `Maximum number of request attempts exceeded (10 total) for "${args.url}"`;
    // workflow
    if (!args.url) throw 'URL undefined in smappi-cl/lib/request';
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
        // console.log(process.argv[0], __dirname + '/worker.js', process.pid, "'" + JSON.stringify(args) + "'");
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
        let retry = () => {
            // if use proxy and request is broken, then turn next
            if (args.options.proxy !== false)
                proxy.next({skipCurrent: true});
            return new Request(method, args, attempts + 1, proxyCondition);
        }
        if (resp.err) {
            if (Object.keys(resp.err).length) {
                let errStr = JSON.stringify(resp.err);
                if (resp.err.options && resp.err.options.command == 'connect') {
                    let postScriptum = '';
                    if (resp.err.options.proxy)
                        postScriptum = ' (probably proxy is wrong)';
                    logger.error(`Problem while connect for "${args.url}"${postScriptum}. Request will be retry. ERR: ${errStr}`);
                    return retry();
                } else if (resp.err.code == 'ECONNRESET') {
                    logger.error(`Connection problems for "${args.url}". Request will be retry. ERR: ${errStr}`);
                    return retry();
                } else if (resp.err.code == 'ETIMEOUT' || resp.err.code == 'ETIMEDOUT') {
                    logger.error(`Connection timeout exceeded for "${args.url}". Request will be retry. ERR: ${errStr}`);
                    return retry();
                } else if (resp.err.code == 'ENOTFOUND' && resp.err.syscall == 'getaddrinfo') {
                    let msg = `Host "${resp.err.hostname}" not found. Please verify A-record for this domain.`;
                    logger.error(msg);
                    throw msg;
                } else {
                    throw errStr;
                }
            } else if (args.proxy && resp.ctx == 'request') {
                return retry(); // Otherwise retry again
            } else if (resp.message) {
                throw resp.message;
            } else {
                throw 'Problem with connection in smappi-cl/lib/request';
            }
        } else {
            let response = new Response(resp, args.url);
            // console.log('RequestResponse check condition', args.url, response.status, !proxyCondition || proxyCondition(response))
            if (!proxyCondition || proxyCondition(response)) {
                // If not proxyCondition or proxyCondition is success
                // return Response
                return response;
            } else {
                return retry(); // Otherwise retry again
            }
        }
    } else {
        throw 'Temporary! Not Implemented Smappi CL Async Requests';
    }
}


function get (urlOrArgs, params, options, headers) {
    if (typeof(urlOrArgs) != 'object')
        urlOrArgs = {url: urlOrArgs, params, options, headers}
    let pc = this.proxyCondition;
    delete this.proxyCondition;
    return new Request('GET', urlOrArgs, 0, pc);
}

function post (urlOrArgs, data, options, headers) {
    if (typeof(urlOrArgs) != 'object')
        urlOrArgs = {url: urlOrArgs, data, options, headers}
    let pc = this.proxyCondition;
    delete this.proxyCondition;
    return new Request('POST', urlOrArgs, 0, pc);
}

function withProxy (condition) {
    this.proxyCondition = condition;
    return this;
}

module.exports = { Request, Response, withProxy, get, post }
