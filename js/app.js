/* global FastClick, smoothScroll */
var myapp = angular.module('finpics', ['ngRoute', 'mgDirectives'], function($httpProvider){

}).run(['$location', function($location){
}]);

myapp.constant('config', {
    bucket: 'finpics-pics',
    domain: 'https://s3.amazonaws.com/finpics-pics',
    CognitoIdentityPoolId: 'us-east-1:ace886dd-7a0b-456c-a49d-b83dbbe8520c'
});

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

myapp.factory('cache', function ($rootScope) {
    var mem = {};

    return {
        store: function (key, value) {
            mem[key] = value;
        },
        get: function (key) {
            return mem[key];
        }
    };
});

myapp.controller('IndexController', IndexController);
myapp.controller('PicsetController', PicsetController);
myapp.controller('PicController', PicController);

function IndexController($scope, $http, $rootScope, config, cache) {
    $rootScope.body_class='index_body';
    $scope.master = {};
    $scope.domain = config.domain;
    var picsets = cache.get('picsets');
    if (!_.isNil(picsets)) {
        $scope.picsets = picsets;
    } else {
        picsets = {};
        $scope.loading = true;
        $http.get('/picsets_image.json').then(function (res) {
            $scope.loading = false;
            picsets = _.map(res.data, function(image) {
                var dir = _.split(image, '/')[0];
                return {
                    path: dir,
                    name: _.join(_.drop(_.split(dir, '_')), ' '),
                    image: image
                }
            });
            $scope.picsets = picsets;
            cache.store('picsets', picsets);
        },function(res) {
            console.log(JSON.stringify(res, null, 3));
            $scope.loading = false;
            $scope.error = true;
            $rootScope.$broadcast('mgalert', 'Please check errors.', 3);
        });
    }
};

function PicsetController($scope, $routeParams, $rootScope, config, cache) {
    $rootScope.body_class='mini_jumbotron picset_body';
    $scope.master = {};
    $scope.domain = config.domain;
    $scope.pics = [];
    var pics = cache.get($routeParams.path);
    if (!_.isNil(pics)) {
        $scope.pics = pics;
    } else {
        pics = [];
        $scope.loading = true;
        // Initialize the Amazon Cognito credentials provider
        AWS.config.region = 'us-east-1'; // Region
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: config.CognitoIdentityPoolId
        });
        console.log('here');
        var s3 = new AWS.S3();
        var done = false;
        var next_marker = null;
        async.until(
            function() {
                return done;
            }, function(asyncCallback) {
                var params = {
                    Bucket: config.bucket, /* required */
                    Prefix: 'photos/'+$routeParams.path
                };
                if (next_marker) {
                    params.Marker = next_marker;
                }
                //console.log(JSON.stringify(params, null, 3));
                s3.listObjects(params, function(err, data) {
                    //console.log(JSON.stringify(data, null, 3));
                    if (err) console.log(err);
                    else {
                        done = !data.IsTruncated;
                        _.each(data.Contents, function(item) {
                            next_marker = item.Key;
                            if (item.Key.indexOf('/thumbs/') > 0 && !_.endsWith(item.Key, '.html') && (_.endsWith(_.toLower(item.Key), '.jpg') || _.endsWith(_.toLower(item.Key), '.jpeg') || _.endsWith(_.toLower(item.Key), '.png'))) {
                                pics.push(item.Key);
                            }
                        });
                    }
                    asyncCallback(err);
                });
            }, function(err) {
                if (err) {
                    $scope.loading = false;
                    $scope.error = true;
                    $rootScope.$broadcast('mgalert', 'Please check errors.', 3);
                } else {
                    $scope.loading = false;
                    $scope.pics = pics;
                    cache.store($routeParams.path, pics);
                    if(!$scope.$$phase) {
                        $scope.$digest($scope);
                    }
                }
            });
    }
};

function PicController($scope, $routeParams, $rootScope, config) {
    $rootScope.body_class='mini_jumbotron pic_body';
    $scope.master = {};
    $scope.domain = config.domain;
    $scope.pic = _.replace($routeParams.pic, '/thumbs', '');
};
