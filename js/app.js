/* global FastClick, smoothScroll */
var myapp = angular.module('finpics', ['ngRoute', 'mgDirectives'], function($httpProvider){

}).run(['$location', function($location){
}]);

myapp.constant('config', {
    bucket: 'finpics-pics',
    domain: 'https://s3.amazonaws.com/finpics-pics',
    domain_thumbs: 'https://s3.amazonaws.com/finpics-thumbs',
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
        when('/search', {
            templateUrl: '/partials/picset.html',
            controller: 'SearchController'
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

myapp.factory('aws', function(config) {
    // Initialize the Amazon Cognito credentials provider
    AWS.config.region = 'us-east-1'; // Region
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: config.CognitoIdentityPoolId
    });

    return {
        docClient: new AWS.DynamoDB.DocumentClient(),
        lambda: new AWS.Lambda()
    };
});

myapp.directive("keepScrollPos", function($route, $window, $timeout, $location, $anchorScroll) {

    // cache scroll position of each route's templateUrl
    var scrollPosCache = {};

    // compile function
    return function(scope, element, attrs) {

        scope.$on('$routeChangeStart', function() {
            // store scroll position for the current view
            if ($route.current) {
                scrollPosCache[$route.current.loadedTemplateUrl] = [ $window.pageXOffset, $window.pageYOffset ];
            }
        });

        scope.$on('$routeChangeSuccess', function() {
            // if hash is specified explicitly, it trumps previously stored scroll position
            if ($location.hash()) {
                $anchorScroll();

                // else get previous scroll position; if none, scroll to the top of the page
            } else {
                var prevScrollPos = scrollPosCache[$route.current.loadedTemplateUrl] || [ 0, 0 ];
                $timeout(function() {
                    $window.scrollTo(prevScrollPos[0], prevScrollPos[1]);
                }, 0);
            }
        });
    }
});

myapp.controller('IndexController', IndexController);
myapp.controller('PicsetController', PicsetController);
myapp.controller('SearchController', SearchController);
myapp.controller('PicController', PicController);

function IndexController($scope, $http, $rootScope, config, cache, aws) {
    $rootScope.body_class='index_body';
    $scope.master = {};
    $scope.domain = config.domain;
    $scope.domain_thumbs = config.domain_thumbs;
    var picsets = cache.get('picsets');
    if (!_.isNil(picsets)) {
        $scope.picsets = picsets;
    } else {
        picsets = {};
        $scope.loading = true;

        var docClient = aws.docClient;
        var params = {
            TableName: 'pics',
            KeyConditionExpression: "primarykey = :primarykey",
            ScanIndexForward: false,
            ExpressionAttributeValues: {
                ":primarykey": '/'
            }
        };
        docClient.query(params, function(err, data) {
            if (err)  {
                $scope.loading = false;
                $scope.error = true;
                $rootScope.$broadcast('mgalert', 'Please check errors.', 3);
                console.log(err);
            } else {
                $scope.loading = false;
                picsets = _.map(data.Items, function(item) {
                    return {
                        path: item.sortkey,
                        name: _.join(_.drop(_.split(item.sortkey, '_')), ' '),
                        image: item.sortkey + '/' + item.pic
                    }
                });
                $scope.picsets = picsets;
                cache.store('picsets', picsets);
            }
            if(!$scope.$$phase) {
                $scope.$digest($scope);
            }
        });
    }
};

function PicsetController($scope, $routeParams, $rootScope, config, cache, aws) {
    $rootScope.body_class='mini_jumbotron picset_body';
    $scope.master = {};
    $scope.domain = config.domain;
    $scope.domain_thumbs = config.domain_thumbs;
    $scope.pics = [];
    var pics = cache.get($routeParams.path);
    if (!_.isNil(pics)) {
        $scope.pics = pics;
    } else {
        pics = [];
        $scope.loading = true;
        var docClient = aws.docClient;
        var params = {
            TableName: 'pics',
            KeyConditionExpression: "primarykey = :primarykey",
            ScanIndexForward: false,
            ExpressionAttributeValues: {
                ":primarykey": $routeParams.path
            }
        };
        docClient.query(params, function(err, data) {
            if (err)  {
                $scope.loading = false;
                $scope.error = true;
                $rootScope.$broadcast('mgalert', 'Please check errors.', 3);
                console.log(err);
            } else {
                $scope.loading = false;
                pics = _.map(data.Items, function(item) {
                    return {
                        primarykey: item.primarykey,
                        sortkey: item.sortkey,
                        data: item.data,
                        image: _.join(['photos', item.primarykey, item.sortkey], '/')
                    }
                });
                $scope.pics = pics;
                cache.store($routeParams.path, pics);
            }
            if(!$scope.$$phase) {
                $scope.$digest($scope);
            }
        });
    }
};

function SearchController($scope, $routeParams, $rootScope, config, cache, aws) {
    $rootScope.body_class='mini_jumbotron picset_body';
    $scope.master = {};
    $scope.domain = config.domain;
    $scope.domain_thumbs = config.domain_thumbs;
    $scope.pics = [];
    var pics = cache.get($routeParams.faceid);
    if (!_.isNil(pics)) {
        $scope.pics = pics;
    } else {
        pics = [];
        $scope.loading = true;
        var params = {
            CollectionId: 'finpics', /* required */
            FaceId: $routeParams.faceid
        };
        // Can't call AWS Rekognition directly due to missing CORS support.  https://github.com/aws/aws-sdk-js/issues/1246
        // Use Lambda -> Rekognition.  Still serverless :)
        var params = {
            FunctionName: 'finpics-dev-search', /* required */
            InvocationType: 'RequestResponse',
            LogType: 'Tail',
            Payload: JSON.stringify({
                faceid: $routeParams.faceid
            })
        };
        aws.lambda.invoke(params, function(err, data) {
            if (err)  {
                $scope.loading = false;
                $scope.error = true;
                $rootScope.$broadcast('mgalert', 'Please check errors.', 3);
                console.log(err);
            } else {
                $scope.loading = false;
                $scope.pics = _.map(JSON.parse(data.Payload).output, function(item) {
                    item.image= _.join(['photos', item.image_path], '/');
                    item.primarykey = _.split(item.image_path, '/')[0];
                    item.sortkey = _.split(item.image_path, '/')[1];
                    return item;
                });
                cache.store($routeParams.faceid, pics);
            }
            if(!$scope.$$phase) {
                $scope.$digest($scope);
            }
        });
    }
};

function PicController($scope, $routeParams, $rootScope, config, cache, aws) {
    $rootScope.body_class='mini_jumbotron pic_body';
    $scope.master = {};
    $scope.domain = config.domain;
    $scope.domain_thumbs = config.domain_thumbs;
    $scope.loading = true;
    var pics = cache.get($routeParams.primarykey);
    if (!_.isNil(pics)) {
        var pic = _.find(pics, {sortkey: $routeParams.sortkey});
    }
    if (_.isNil(pic)) {
        var params = {
            TableName: 'pics',
            Key:{
                primarykey: $routeParams.primarykey,
                sortkey: $routeParams.sortkey
            }
        };
        aws.docClient.get(params, function(err, data) {
            if (err)  {
                $scope.loading = false;
                $scope.error = true;
                $rootScope.$broadcast('mgalert', 'Please check errors.', 3);
                console.log(err);
            } else {
                $scope.loading = false;
                $scope.pic = {
                        primarykey: data.Item.primarykey,
                        sortkey: data.Item.sortkey,
                        data: data.Item.data,
                        image: _.join(['photos', data.Item.primarykey, data.Item.sortkey], '/')
                    };
            }
            if(!$scope.$$phase) {
                $scope.$digest($scope);
            }
        });
    } else {
        $scope.loading = false;
        $scope.pic = pic;
    }
};
