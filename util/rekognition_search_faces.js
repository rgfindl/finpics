var AWS = require('aws-sdk');
var rekognition = new AWS.Rekognition({apiVersion: '2016-06-27'});

var params = {
    CollectionId: 'finpics', /* required */
    Image: { /* required */
        S3Object: {
            Bucket: 'finpics-com',
            Name: 'images/RandyFindleyHeadshot_web.jpeg'
        }
    }
};
rekognition.searchFacesByImage(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(JSON.stringify(data, null, 3));           // successful response
});
