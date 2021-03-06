const http = require('http'),
      https = require('https'),
      dns = require('dns'),
      fs = require('fs'),
      url = require('url'),
      ProxyAgent = require('proxy-agent'),
      querystring = require('querystring'),
      FormData = require('form-data');


// temporary solution
const browser = {
    'Accept': 'text/html, application/xhtml+xml, application/xml; q=0.9, image/webp, image/apng, */*; q=0.8',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36'
}

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
    let options = url.parse(args.url);
    options.headers = args.headers;
    options.method = args.method;
    if (args.proxy) {
        console.log('Current Proxy:', args.proxy);
        options.agent = new ProxyAgent(args.proxy); // ONLY IP ADDR, NOT DOMAIN NAME
        options.agent.timeout = 2000;
    }
    const contentFile = ".smappi-request-content-" + ppid,
          syncFile = ".smappi-request-sync-" + ppid,
          doRequest = (options.protocol.startsWith('https') ? https : http).request;
    // check domain, may have incorrectly specified the host
    if (options.host.split(':')[0] != 'localhost') {
        dns.lookup(options.host, error => {
            if (!error) return;
            errorMsg(ppid, error, 'request', error.message);
        });
    }
    // temporary browser headers
    options.headers['Accept'] = options.headers['Accept'] || browser['Accept'];
    options.headers['User-Agent'] = options.headers['User-Agent'] || browser['User-Agent'];
    options.headers['Connection'] = options.headers['Connection'] || 'keep-alive';
    options.headers['Host'] = options.host;
    var body = [];
    function responseHandler (response) {
        if (args.options.encoding !== null) {
            response.setEncoding(args.options.encoding || 'utf8');
        }
        response.on('data', chunk => {
            // console.log('Rquest Chunk Buffer Hex', Buffer.from(chunk.slice(0, 10)).toString('hex'));
            body.push(Buffer.from(chunk));
        });
        response.on('end', () => {
            let responseText = Buffer.concat(body).toString(
                (args.options.encoding === null ? 'binary' : 'utf8')
            );
            // console.log('Rquest End Body Buffer Hex', Buffer.from(responseText.slice(0, 10)).toString('hex'));
            fs.writeFileSync(contentFile, JSON.stringify({
                err: null,
                status: response.statusCode,
                headers: response.headers,
                responseText
            }), 'utf8');
            // console.log('responseText', responseText)
            fs.existsSync(syncFile) && fs.unlinkSync(syncFile);
        });
        response.on('error', error => errorMsg(ppid, error, 'response'));
        response.resume();
    }
    function errorHandler (error) {
        // connection problem? may be proxy?
        errorMsg(
            ppid, error, 'request',
            'Probably a problem with the proxy in smappi-cl/lib/request'
        );
    }
    // Form Data
    var multipart = false,
        form = new FormData();
    if (args.method == 'POST') {
        var key, obj, cont;
        for (key in args.data) {
            if (!args.data.hasOwnProperty(key)) continue;
            obj = args.data[key];
            if (typeof(obj) == 'object' && obj.content) {
                multipart = true;
                cont = obj.content;
                delete obj.content;
                cont = Buffer.from(cont, 'binary');
                form.append(key, cont, obj);
            } else {
                form.append(key, obj);
            }
        }
        if (multipart) {
            // POST: multipart/form-data
            options.headers = form.getHeaders(options.headers);
            form.submit(args.url, function(err, res) {
                if (err) {
                    errorHandler(err);
                } else {
                    responseHandler(res);
                }
            });
        } else {
            // POST: application/x-www-form-urlencoded
            const postData = querystring.stringify(args.data);
            options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/x-www-form-urlencoded';
            options.headers['Content-Length'] = options.headers['Content-Length'] || Buffer.byteLength(postData);
            const req = doRequest(options, responseHandler).on('error', errorHandler);
            req.write(postData);
            req.end();
        }
    } else {
        // e.g.: GET
        doRequest(options, responseHandler)
            .on('error', errorHandler)
            .end();
    }
    return true;
}

try {
    worker(process.argv[2], JSON.parse(process.argv[3]));
} catch (err) {
    console.error(err)
    errorMsg(process.argv[2], err, 'catch', err.message);
}
