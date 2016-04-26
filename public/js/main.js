"use strict";

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function formatDate(date, noMinutes){
    var df = (date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear();

    if(!noMinutes)
        df += "  "+pad(date.getHours(), 2) + ":" + pad(date.getMinutes(), 2);
    return df;
}

//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&

var app = angular.module('alfbot', ['ngSanitize']);

app.controller('bot', ['$scope', 'commonData', function($scope, commonData) {
    $scope.commonData = commonData;

    $scope.placeSelectedPodInSlot = function(slotNumber) {
        var pod = $scope.commonData.getSelectedPod();
        if(pod){
            pod.deselect();
            pod.disable();
            $scope.commonData.getSlot(slotNumber).pod = pod;
        } else {
            console.log("No pod selected!");
        }
    };

}]);

app.controller('controlPanel', ['$scope', 'commonData', function($scope, commonData) {
    $scope.commonData = commonData;
    $scope.incPills = function(podId){
        $scope.commonData.getPod(podId).numberOfPills++;
    };
    $scope.decPills = function(podId){
        $scope.commonData.getPod(podId).numberOfPills--;
    };
    $scope.select = function(podId){
        $scope.commonData.deselectAllPods();
        $scope.commonData.selectPod(podId);
    };
    $scope.manualOverride = function(on){
        $scope.isManualOverride = on;
        commonData.onIngressChange(on);
        if(on){
            commonData.openAllSlots();
        } else {
            commonData.closeAllSlots();
        }
    };
    $scope.isManualOverride = false;
}]);

app.controller('logger', ['$scope', 'logData', function($scope, logData) {
    $scope.logData = logData;


}]);

app.factory('logData', function(){
    var logData = {};
    logData.logs = ["---",".",".","."];
    logData.log = function(str) {
        logData.logs.unshift(str);
    };
    return logData;
});
app.factory('commonData', function(){
    var data = {};
    data.ingressChangeListener = null;
    data.trays = [];
    data.trays.push(new Tray(6, [new Slot(11), new Slot(12)]));
    data.trays.push(new Tray(5, [new Slot(9), new Slot(10)]));
    data.trays.push(new Tray(4, [new Slot(7), new Slot(8)]));
    data.trays.push(new Tray(3, [new Slot(5), new Slot(6)]));
    data.trays.push(new Tray(2, [new Slot(3), new Slot(4)]));
    data.trays.push(new Tray(1, [new Slot(1), new Slot(2)]));

    data.defaultPods = [
                new Pod("E0040150735A08FD", "A0000011 -Ator", 20, 214),
                new Pod("E0040150735A08FE", "A0000010 -MetHyd", 20, 154),
                new Pod("E004015073590EF7", "A0000009 -RefillAtor", 10, 214),
                new Pod("E0040150735A07D6", "A0000008 -New", 20, 2),
                new Pod("?", "apixaban", 30, 100),
                new Pod("?", "Lisinoril", 30, 100),
                new Pod("?", "Metformin", 60, 100),
                new Pod("?", "simvastatin", 30, 100)
                ];

    data.removePod = function(pod){
        for(var i=0; i<data.pods.length; i++){
            if(pod == data.pods[i]) {
                data.pods.splice(i, 1);
                break;
            }
        }
    };

    data.createPod = function(){
        data.pods.push(new Pod("", "", 10, 100));
    };

    data.resetPods = function(){
        data.pods = [];
        for(var i=0; i<data.defaultPods.length; i++){
            data.pods.push(new Pod(data.defaultPods[i].id, data.defaultPods[i].name, data.defaultPods[i].numberOfPills, data.defaultPods[i].weightPerPill));
        }
    };

    data.onIngressChange = function(ingressBool){
        if(data.ingressChangeListener) {
            data.ingressChangeListener.onChange(ingressBool);
        }
    };

    data.slotIsOpen = function(podId) {
        for(var i=0; i<data.trays.length; i++) {
            for(var j=0; j<data.trays[i].slots.length; j++){
                var slot = data.trays[i].slots[j];
                if(slot.pod && slot.pod.id == podId){
                    return slot.isOpen;
                }
            }
        }
        return false;
    };

    data.deselectAllPods = function() {
        for(var i=0; i<data.pods.length; i++){
            data.pods[i].deselect();
        }
    };
    data.selectPod = function(podId) {
        data.getPod(podId).select();
    };

    data.getSelectedPod = function() {
        for(var i=0; i<data.pods.length; i++){
            if(data.pods[i].isSelected){
                return data.pods[i];
            }
        }
        return null;
    };

    data.getPod = function(podId) {
        for(var i=0; i<data.pods.length; i++){
            if(data.pods[i].id == podId){
                return data.pods[i];
            }
        }
        return null;
    };

    data.getSlot = function(slotNumber) {
        for(var i=0; i<data.trays.length; i++){
            for(var j=0; j<data.trays[i].slots.length; j++){
                if(slotNumber == data.trays[i].slots[j].number)
                {
                    return data.trays[i].slots[j];
                }
            }
        }
        return null;
    };

    data.getTray = function(trayNumber) {
        for(var i=0; i<data.trays.length; i++) {
            if(data.trays[i].number == trayNumber) {
                return data.trays[i];
            }
        }
        return null;
    };

    data.getTrayBySlot = function(slotNumber) {
        for(var i=0; i<data.trays.length; i++) {
            for(var j=0; j<data.trays[i].slots.length; j++){
                if(data.trays[i].slots[j].number == slotNumber) {
                    return data.trays[i];
                }
            }
        }
        return null;
    };

    data.openSlot = function(slotNumber) {
        for(var i=0; i<data.trays.length; i++){
            for(var j=0; j<data.trays[i].slots.length; j++){
                if(slotNumber == data.trays[i].slots[j].number)
                {
                    data.trays[i].closeAllSlots();
                    data.trays[i].slots[j].open();
                }
            }
        }
        return null;
    };

    data.openAllSlots = function(){
        for(var i=0; i<data.trays.length; i++){
            for(var j=0; j<data.trays[i].slots.length; j++){
                data.trays[i].slots[j].open();
            }
        }
    };

    data.closeAllSlots = function(){
        for(var i=0; i<data.trays.length; i++){
            for(var j=0; j<data.trays[i].slots.length; j++){
                data.trays[i].slots[j].close();
            }
        }
    };
    data.resetPods();
    return data;
});


function Pod(id, name, numberOfPills, weightPerPill){
    this.id = id;
    this.name = name;
    this.weightPerPill = weightPerPill;
    this.podWeight = 20000;
    this.numberOfPills = numberOfPills || 0;
    this.enabled = true;

    this.getWeight = function() {
        var w = this.numberOfPills * this.weightPerPill;
        return (w>=0 ? w : 0) + this.podWeight;
    };

    this.select = function(){
        this.isSelected = true;
    };

    this.deselect = function(){
        this.isSelected = false;
    }

    this.disable = function(){
        this.enabled = false;
    }

    this.enable = function(){
        this.enabled = true;
    }
}

function Slot(number){
    this.number = number;
    this.pod = null;
    this.isOpen = false;

    this.removePod = function(){
        this.pod.enable();
        this.pod = null;
    };

    this.open = function(){
        this.isOpen = true;
    };

    this.close = function(){
        this.isOpen = false;
    };

    this.getPodId = function() {
        return this.pod ? this.pod.id : "";
    };

    this.getWeight = function() {
        if(this.pod) {
            return this.pod.getWeight();
        } else {
            return 0;
        }
    };

    this.getColor = function(){
        if(this.isMoving){
            return "#FFC107";
        } else {
            return this.isOpen ? "#afa" : "#EEE";
        }
    };

    this.moveStart = function() {
        this.isMoving = true;
    };

    this.moveEnd = function() {
        this.isMoving = false;
    };
}

function Tray(number, slots) {
    this.number = number;
    this.slots = slots;
    this.baseWeight = 1000000;

    this.getWeight = function() {
        return this.baseWeight + this.slotWeightSum();
    };

    this.slotWeightSum = function(){
        var sum = 0;
        for(var i=0; i<this.slots.length; i++) {
            sum += this.slots[i].getWeight();
        }
        return sum;
    };

    this.closeAllSlots = function(){
        for(var i=0; i<this.slots.length; i++) {
            this.slots[i].close();
        }
    };

    this.moveStart = function() {
        for(var i=0; i<this.slots.length; i++) {
            this.slots[i].moveStart();
        }
    };

    this.moveEnd = function() {
        for(var i=0; i<this.slots.length; i++) {
            this.slots[i].moveEnd();
        }
    };
}