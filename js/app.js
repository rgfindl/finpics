/* global FastClick, smoothScroll */
var myapp = angular.module('finpics', ['ngRoute', 'mgDirectives'], function($httpProvider){

}).run(['$location', function($location){
}]);

//
// Routes
//
myapp.config(['$routeProvider',
    function($routeProvider) {
        $routeProvider.
        when('/index', {
            templateUrl: '/partials/index.html',
            controller: 'IndexController'
        }).
        when('/picset', {
            templateUrl: '/partials/picset.html',
            controller: 'PicsetController'
        }).
        when('/pic', {
            templateUrl: '/partials/pic.html',
            controller: 'PicController'
        }).
        otherwise({
            redirectTo: '/index'
        });
    }]);



myapp.controller('IndexController', IndexController);
myapp.controller('PicsetController', PicsetController);

function IndexController($scope, $http) {
    $scope.master = {};
    $scope.picsets = {};

    $scope.loading = true;
    $http.get('/picsets_image.json').then(function (res) {
        $scope.loading = false;
        $scope.picsets = _.map(res.data, function(image) {
            var dir = _.split(image, '/')[0];
            return {
                path: dir,
                name: _.join(_.drop(_.split(dir, '_')), ' '),
                image: image
            }
        });
    },function(res) {
        console.log(JSON.stringify(res, null, 3));
        $scope.loading = false;
        $scope.error = true;
        $rootScope.$broadcast('mgalert', 'Please check errors.', 3);
    });
};

function PicsetController($scope, $routeParams, $http) {
    $scope.pics = [];
    // Initialize the Amazon Cognito credentials provider
    AWS.config.region = 'us-east-1'; // Region
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'us-east-1:ace886dd-7a0b-456c-a49d-b83dbbe8520c'
    });
    AWS.config.credentials.get(function(){
        console.log('here');
        var s3 = new AWS.S3();
        var done = false;
        var next_marker = null;
        async.until(
            function() {
                return done;
            }, function(asyncCallback) {
                var params = {
                    Bucket: 'finpics.com', /* required */
                    Prefix: '/photos/'+$routeParams.path
                };
                if (next_marker) {
                    params.Marker = next_marker;
                }
                s3.listObjects(params, function(err, data) {
                    if (err) console.log(err);
                    else {
                        done = !data.IsTruncated;
                        async.eachSeries(data.Contents, function(item, eachCallback) {
                            next_marker = item.Key;
                            if (item.Key.indexOf('/thumbs/') <= 0 && !_.endsWith(item.Key, '.html') && (_.endsWith(_.toLower(item.Key), '.jpg') || _.endsWith(_.toLower(item.Key), '.jpeg') || _.endsWith(_.toLower(item.Key), '.png'))) {
                                $scope.pics.push(item.Key);
                                eachCallback(null);
                            } else
                                eachCallback(null);
                        }, asyncCallback);
                    }
                });
            }, function(err) {
                if (err) winston.error(err);
                winston.info(next_marker);
                winston.info('Done!');
            });
    });

};
