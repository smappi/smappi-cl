const http = require('http'),
      https = require('https'),
      dns = require('dns'),
      fs = require('fs'),
      url = require('url'),
      ProxyAgent = require('proxy-agent'),
      querystring = require('querystring');

// ************************************************************************************
//
// Worker starts (see "spawn" in smappi-cl/lib/request/index.js) as a separate process,
// so that while can not block the execution of the requester
//
// Exchange data via the file "contentFile"
// Also there is a mutex for synchronization index.js and worker.js
//
// ************************************************************************************

function errorMsg (ppid, error, ctx, msg) {
    let contentFile = ".smappi-request-content-" + ppid,
        syncFile = ".smappi-request-sync-" + ppid;
    fs.writeFileSync(contentFile, JSON.stringify({err: error, ctx: ctx, message: msg}), 'utf8');
    fs.existsSync(syncFile) && fs.unlinkSync(syncFile);
}

function worker (ppid, args) {
    if (args.method == 'GET' && typeof(args.params) == 'object' && JSON.stringify(args.params) != '{}') {
        args.url += (args.url.indexOf('?') > -1) ? '&' : '?';
        args.url += querystring.encode(args.params);
    }
    let options = url.parse(args.url),
        responseText = '';
    options.headers = args.headers;
    options.method = args.method;
    if (args.proxy) {
        console.log('Current Proxy:', args.proxy);
        options.agent = new ProxyAgent(args.proxy); // ONLY IP ADDR, NOT DOMAIN NAME
        options.agent.timeout = 2000;
    }
    const postData = querystring.stringify(args.data),
          contentFile = ".smappi-request-content-" + ppid,
          syncFile = ".smappi-request-sync-" + ppid,
          doRequest = (options.protocol.startsWith('https') ? https : http).request;
    // check domain, may have incorrectly specified the host
    dns.lookup(options.host, (error) => {
        if (!error) return;
        errorMsg(ppid, error, 'request', error.message);
    });
    if (args.method == 'POST') {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    options.headers['Accept'] = 'text/html, application/xhtml+xml, application/xml; q=0.9, image/webp, image/apng, */*; q=0.8';
    options.headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36';
    options.headers['Connection'] = 'keep-alive';
    options.headers['Host'] = options.host;
    const req = doRequest(options, function (response) {
        response.setEncoding('utf8');
        response.on('data', function (chunk) {
            responseText += chunk;
        });
        response.on('end', function () {
            fs.writeFileSync(contentFile, JSON.stringify({
                err: null,
                status: response.statusCode,
                headers: response.headers,
                responseText
            }), 'utf8');
            fs.existsSync(syncFile) && fs.unlinkSync(syncFile);
        });
        response.on('error', function (error) {
            errorMsg(ppid, error, 'response');
        });
    }).on('error', function (error) {
        // connection problem? may be proxy?
        errorMsg(
            ppid, error, 'request',
            'Probably a problem with the proxy in smappi-cl/lib/request'
        );
    });
    if (postData) req.write(postData);
    req.end();
    return req;
}

try {
    worker(process.argv[2], JSON.parse(process.argv[3]));
} catch (err) {
    console.error(err)
    errorMsg(process.argv[2], err, 'catch', err.message);
}
