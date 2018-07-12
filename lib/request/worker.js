const http = require('http'),
      https = require('https'),
      fs = require('fs'),
      url = require('url'),
      SocksProxyAgent = require('socks-proxy-agent'),
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

(function (ppid, args) {
    if (args.method == 'GET' && typeof(args.params) == 'object' && JSON.stringify(args.params) != '{}') {
        args.url += (args.url.indexOf('?') > -1) ? '&' : '?';
        args.url += querystring.encode(args.params);
    }
    let options = url.parse(args.url),
        responseText = '';
    options.headers = args.headers;
    if (args.proxy) {
        console.log('Current Proxy:', args.proxy);
        options.agent = new SocksProxyAgent(args.proxy);
    }
    const postData = querystring.stringify(args.data),
          contentFile = ".smappi-request-content-" + ppid,
          syncFile = ".smappi-request-sync-" + ppid,
          doRequest = (options.protocol.startsWith('https') ? https : http).request;
    if (args.method == 'POST') {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
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
            fs.unlinkSync(syncFile);
        });
        response.on('error', function (error) {
            fs.writeFileSync(contentFile, JSON.stringify({err: error, ctx: 'response'}), 'utf8');
            fs.unlinkSync(syncFile);
        });
    }).on('error', function (error) {
        // connection problem? may be proxy?
        fs.writeFileSync(contentFile, JSON.stringify({
            err: error,
            ctx: 'request',
            message: 'Probably a problem with the proxy in smappi-cl/lib/request'
        }), 'utf8');
        fs.unlinkSync(syncFile);
    });
    if (postData) req.write(postData);
    req.end();
    return req;
})(process.argv[2], JSON.parse(process.argv[3]));
