angular.module('mgDirectives').directive('mgAlert', [ '$timeout',
	function($timeout) {
        return {
            restrict: 'E',
            link: function($scope, elem, attrs, ctrl) {
                  $scope.alertStati = {
                        1: 'alert-success',
                        2: 'alert-warning',
                        3: 'alert-danger'
                  };

                  $scope.$on('mgalert', function(event, message, status){
                        $scope.showAlert = true;
                        $scope.status = status;
                        $scope.message = message;
                      console.log(message);

                        $timeout(function() {
                              $scope.showAlert = false;
                        }, 2000);
                  });

            },
            template: 
            '<div class="mg-alert" ng-class="alertStati[status] || alertStati[1]" ng-if="showAlert">' +
                  '<p ng-bind="message"></p>' +
            '</div>'
        }
	}
]);