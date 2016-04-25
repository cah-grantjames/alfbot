
app.controller('socketController', ['$scope', 'socket', 'commonData', 'logData',
                    function($scope, socket, commonData, logData) {
    $scope.usbOn = false;
    $scope.connected = false;
    $scope.commonData = commonData;
    $scope.commonData.ingressChangeListener = {
        onChange : function(ingressBool) {
            socket.emit('send:ingressChange', {
                ingressBool : ingressBool
            }, function (result) {});
        }
    };
    $scope.logData = logData;

    socket.on('connected', function (data) {
        console.log('connected!!', data);
        $scope.connected = true;
        $scope.usbOn = data.usbOn;
    });

    socket.on('status:usb', function (data) {
        console.log('usbOn?', data.usbOn);
        $scope.usbOn = data.usbOn;
    });

    socket.on('moveStart', function (response) {
        console.log("moveStart", response);
        if(response.slotNumber){
            $scope.commonData.getTrayBySlot(response.slotNumber).moveStart();
        } else if(response.trayNumber){
            $scope.commonData.getTray(response.trayNumber).moveStart();
        }
    });

    socket.on('moveEnd', function (response) {
        console.log("moveEnd", response);
        if(response.slotNumber){
            $scope.commonData.getTrayBySlot(response.slotNumber).moveEnd();
        } else if(response.trayNumber){
            $scope.commonData.getTray(response.trayNumber).moveEnd();
        }
    });

    socket.on('sendOpenPod', function (response) {
        console.log("sendOpenPod", response);
        $scope.commonData.openSlot(response.slotNumber);
    });

    socket.on('sendCloseTray', function (response) {
        console.log("sendCloseTrayPod", response);
        $scope.commonData.getTray(response.trayNumber).closeAllSlots();
    });

    socket.on('sendGetScaleWeight', function (response) {
        console.log("sendGetScaleWeight|trayNumber:", response.trayNumber);
        var weight = $scope.commonData.getTray(response.trayNumber).getWeight();
         socket.emit('send:weight', {
              trayNumber : response.trayNumber,
              weight : weight
            }, function (result) {});
    });

    socket.on('sendGetPodId', function (response) {
        console.log("sendGetPodId|slotNumber:", response.slotNumber);
        var podId = $scope.commonData.getSlot(response.slotNumber).getPodId();
        socket.emit('send:podId', {
              podId: podId
            }, function (result) {});
    });

    socket.on('alflog', function (response) {
        $scope.logData.log(response.line);
    });
}]);

app.factory('socket', function ($rootScope) {
    var socket = io.connect();
    return {
        on: function (eventName, callback) {
            socket.on(eventName, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    callback.apply(socket, args);
                });
            });
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    if (callback) {
                        callback.apply(socket, args);
                    }
                });
            });
        }
    };
});
