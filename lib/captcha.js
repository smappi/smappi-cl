const request = require('./request');

function Captcha (content) {
    this.content = content;
    this.smappiApiKey = process.env.SMAPPI_API_KEY;
    this.smappiCaptchaHost = 'https://captcha.smappi.org';
    if (process.env.ENVIRON == 'debug') {
        this.smappiCaptchaHost = 'http://127.0.0.1:8005';
        this.smappiApiKey = 'test_smappi_api_key';
    }
    this.resolve = function () {
        let content = {
            content: this.content,
            filename: 'captcha.png',
            filepath: 'captcha.png',
            contentType: 'application/octet-stream',
            knownLength: this.content.length
        };
        let response = request.post(
            this.smappiCaptchaHost + '/resolve',
            {content},
            {encoding: null},
            {smappi_api_key: this.smappiApiKey}
        );
        return response.json();
    }
    return this;
}

module.exports = Captcha;
