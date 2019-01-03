'use strict';

const { JSDOM } = require('jsdom');

module.exports = {
    DOM: function (html) {
        // Return window
        return (new JSDOM(html)).window;
    },
    jquery: require('jquery'),
    request: require('./request'),
    logger: require('./logging').logger,
    Caches: require('./cache').Caches,
    proxy: require('./proxy'),
    captcha: require('./captcha')
}
