const querystring = require('querystring');
const { XMLHttpRequest } = require('xmlhttprequest');

function Response (request, sourceUrl) {
    this.request = request;
    this.content = request.responseText;
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
    args.data = args.data || {}; // POST/PUT
    args.params = args.params || {}; // GET
    args.headers = args.headers || {};
    args.options = args.options || {};
    let key,
        url = args.url,
        req = new XMLHttpRequest();
    if (method == 'GET' && args.params) {
        url = args.url + '?' + querystring.encode(args.params);
    }
    req.open(method || 'GET', url, args.options.async || false);
    if (method == 'POST') {
        req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    }
    for (key in args.headers) {
        if (!key) continue;
        req.setRequestHeader(key, args.headers[key]);
    }
    let body = [];
    if (typeof(args.data) == 'string') {
        body.push(args.data);
    } else {
        for (key in args.data) {
            if (!key) continue;
            body.push(key + '=' + encodeURIComponent(args.data[key]));
        }
    }
    req.send(body.join('&') || null);
    return new Response(req, url);
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
