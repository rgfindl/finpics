# finpics
Use AWS Rekognition to provide a faces search of finpics.com

## Develop locally
npm install local-web-server
ws

## Deploy
Install AWS CLI and configure profile credentials.

### Web Assets
aws s3 sync . s3://finpics.com --exclude "photos/*" --exclude ".gitignore" --exclude ".idea/*" --exclude ".git/*" --exclude "util/*" --exclude "node_modules/*" --exclude "package.json" --dryrun --storage-class REDUCED_REDUNDANCY --profile bluefin

### Photos
aws s3 sync . s3://finpics-pics --exclude "*" --include "photos/*" --storage-class REDUCED_REDUNDANCY --profile bluefin
