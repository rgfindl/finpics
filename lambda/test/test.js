var assert = require('assert');
var winston = require('winston');
var _ = require('lodash');

var handler = require('../handler');

describe('lambda', function() {
    it('search', function (done) {
        handler.search({
            faceid: '94e24980-308f-5876-adaf-0ae8630f245a'
        }, null, function(err, response) {
            assert.ok(response);
            done();
        });
    });
});