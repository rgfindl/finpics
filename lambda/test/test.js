var assert = require('assert');
var winston = require('winston');
winston.level = 'debug';
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
    it('s3', function(done) {
        this.timeout(10000);
        handler.s3({
            Records: [
                {
                    s3: {
                        bucket: {
                            name: 'finpics-pics'
                        },
                        object: {
                            key: 'photos/001_penn_state/pennstate_pic_1.jpg'
                        }
                    }
                }
            ]
        }, null, function(err, response) {
            assert.ok(response);
            done();
        });
    });
});