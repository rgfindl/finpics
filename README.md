# finpics
Use AWS Rekognition to provide a faces search of finpics.com

## DynamoDB
### pics table
* primaykey (Primary Key)
* sortKey (Sort Key)
* ... Rekognition IndexFaces response

*Picsets*
* primaykey: '/' (Primary Key)
* sortkey: '014_newportboston' (Sort Key)
* pic: 'Newport_pic_3.jpg'

*Pics*
* primaykey: '014_newportboston' (Primary Key)
* sortkey: 'Newport_pic_3.jpg' (Sort Key)
* ... Rekognition IndexFaces response

## Develop locally
npm run serve

## Deploy
Install AWS CLI and configure profile credentials.

### Web Assets
npm run deploy-site

### Photos
npm ren deploy-pics

## TODO
- Build lambda to handle S3 events.
 - Add feature pic.
 - Index image.
 - Store face information in dynamodb.
 - Generate thumb.
- Add logic to UI to show faces within each image.
- Make faces clickable which searches for more images with that face.
- Add Federated Facebook login.
- Allow people to select their face.