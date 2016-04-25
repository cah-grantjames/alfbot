
console.log("@");
var runner = new Runner();


var express = require('express');
var app = express();
var fs = require('fs');
var broadcaster = new Broadcaster(runner);
var interpreter = new Interpreter(broadcaster);

var port = 8030;
app.use(express.static(__dirname + '/public'));
app.get('/test', function(req, res){
    res.send('working');
});
var server = require('http').createServer(app);
//
var io = require('socket.io').listen(server);

//~~~
app.sockets = [];
io.sockets.on('connection', function (socket) {
    console.log('Connection establish:', socket.id);
    var found = false;
    for(var i=0; i<app.sockets.length; i++) {
        if(app.sockets[i].id == socket.id){
            app.sockets[i] = socket;
            found = true;
            break;
        }
    }
    if(!found) {
        app.sockets.push(socket);
    }

    // sending a message back to the client
    socket.emit('connected', {usbOn: interpreter.on });

    socket.on('send:weight', function(data) {
        interpreter.broadcaster.sendWeight(data.trayNumber, data.weight);
    });
    socket.on('send:podId', function(data) {
        interpreter.broadcaster.sendPodId(data.podId);
    });
    socket.on('send:ingressChange', function(data) {
        interpreter.broadcaster.sendIngress(data.ingressBool);
    });

    if(app.update) {
        app.update.onConnectedSocket(socket);
    }
    socket.lastCheckSum = 0;
});

io.emmitter = {
    emit : function(name, data){
        for(var i=0; i<app.sockets.length; i++){
            try{
                app.sockets[i].emit(name, data);
            } catch(e){
                console.log(e);
            }
        }
    }
};
//~~~


server.listen(port);
console.log("@ listening on port" + port);



//~~~~~~~~~~~~~~~$$$$$$$$$
//~~~~~~~~~~~~~~~$$$$$$$$$
//~~~~~~~~~~~~~~~$$$$$$$$$
//~~~~~~~~~~~~~~~$$$$$$$$$
runner._run('adb', ['devices'], interpreter, function(out, error){
    if(out.replace("List of devices attached", "").trim() == ""){
        console.log("No devices connected!! Exiting!");
        process.exit(1);
    }
    runner._run('adb', ['logcat'], interpreter, function(out, error){
    });
});

function Broadcaster(runner) {
    this.runner = runner;
    this.on = false;
    ////adb shell "am broadcast -a blah.blahblah123 --es test 123"
    this.sendWeight = function(trayNumber, weight){
       var filter = "com.cardinalhealth.alfred.patient.firmware.api.FWControllerInterface.WEIGHT_RECEIVED_NOTIFICATION";
       this.runner.run("adb",
               ["shell", "am","broadcast","-a",filter,"--ei", "WEIGHT_EXTRA", weight],
           function(out, err){
           });
    };

    this.sendPodId = function(podId){
       var filter = "com.cardinalhealth.alfred.patient.firmware.api.FWControllerInterface.POD_ID_RECEIVED_NOTIFICATION";
       this.runner.run("adb",
               ["shell", "am","broadcast","-a",filter,"--es", "SERIAL_NUMBER_EXTRA", podId],
           function(out, err){
           });
    };

    this.sendOpenPodComplete = function(podId){
       var filter = "com.cardinalhealth.alfred.patient.firmware.api.FWControllerInterface.POD_OPENED_NOTIFICATION";
       this.runner.run("adb",
               ["shell", "am","broadcast","-a",filter],
           function(out, err){
           });
    };

    this.sendCloseTrayComplete = function(podId){
       var filter = "com.cardinalhealth.alfred.patient.firmware.api.FWControllerInterface.TRAY_CLOSED_NOTIFICATION";
       this.runner.run("adb",
               ["shell", "am","broadcast","-a",filter],
           function(out, err){
           });
    };

    this.sendIngress = function(ingressBool){
       console.log("sendIngress", ingressBool);
       var filter = "com.cardinalhealth.alfred.patient.firmware.api.FWControllerInterface.MANUAL_OVERRIDE_CHANGE_NOTIFICATION";
       var extraKey = "com.cardinalhealth.alfred.patient.firmware.api.FWControllerInterface.MANUAL_OVERRIDE_IS_ON";
       this.runner.run("adb",
               ["shell", "am","broadcast","-a",filter,"--ez",extraKey,ingressBool],
           function(out, err){
           });
    };
}

function Interpreter(broadcaster){
    this.broadcaster = broadcaster;
    this.PREFIX = "alfbot_cmd";
    this.PREFIX_LOG = "alfbot_log";
    this.DELIM = "|*|";
    this.on = false;
    this.disconnected = false;

    var self = this;
    setTimeout(function(){
        console.log("ON!");
        self.setOn(true);
    }, 5000);

    setInterval(function(){
        runner._run('adb', ['devices'], interpreter, function(out, error){
            if(out.replace("List of devices attached", "").trim() == ""){
                console.log("No devices connected!!");
                self.disconnected=true;
                self.setOn(false);
            } else if(self.disconnected) {
                console.log("Connected!!");
                self.disconnected = false;
                runner._run('adb', ['logcat'], interpreter, function(out, error){
                });
                setTimeout(function(){
                    console.log("ON!");
                    self.setOn(true);
                }, 5000);
            }
        });
    }, 2500);

    this.setOn = function(on) {
        this.on = on;
        io.emmitter.emit("status:usb", {usbOn: this.on});

    };

    this.onData = function(data) {

        if(!this.on)
            return;


        data = data ? data.toString() : "";
        if(data && data.indexOf(this.PREFIX) != -1){
            this.onCommandLine(data);
        } else if(data && data.indexOf(this.PREFIX_LOG) != -1) {
            console.log("\t$$$", data);
            io.emmitter.emit("alflog", {line: data});
        }
//        io.emmitter.emit("logcat", {line: data});
    };

    this.onCommandLine = function(line) {
        for(var i=0; i<this.CMDS.length; i++) {
            if(line.indexOf(this.PREFIX
                + this.DELIM
                + this.CMDS[i]) != -1) {
                var args = line.split(this.DELIM).splice(2);
                this[this.CMDS[i]](args);
                break;
            }
        }
    };

    this.sendGetPodId = function(args){
        var slotNumber = args[0];
        io.emmitter.emit("sendGetPodId", {slotNumber: slotNumber});
        console.log("sendGetPodId", slotNumber);
    };

    this.sendCloseTray = function(args){
        var self = this;
        var trayNumber = args[0];
        io.emmitter.emit("moveStart", {trayNumber: trayNumber});
        setTimeout(function(){
            io.emmitter.emit("moveEnd", {trayNumber: trayNumber});
            io.emmitter.emit("sendCloseTray", {trayNumber: trayNumber});
            self.broadcaster.sendCloseTrayComplete();
            console.log("sendCloseTray", trayNumber);
        }, 4000);
    };

    this.sendOpenPod = function(args){
        var self = this;
        var slotNumber = args[0];
        io.emmitter.emit("moveStart", {slotNumber: slotNumber});
        setTimeout(function(){
            io.emmitter.emit("moveEnd", {slotNumber: slotNumber});
            io.emmitter.emit("sendOpenPod", {slotNumber: slotNumber});
            self.broadcaster.sendOpenPodComplete();
            console.log("sendOpenPod", slotNumber);
        }, 4000);
    };

    this.sendGetScaleWeight = function(args){
        var trayNumber = args[0];
        console.log("sendGetScaleWeight", trayNumber);
        io.emmitter.emit("sendGetScaleWeight", {trayNumber: trayNumber});
    };

    this.CMDS = [ "sendGetPodId", "sendCloseTray", "sendOpenPod", "sendGetScaleWeight"];
}
//~~~~~~~~~~~~~~~$$$$$$$$$
//~~~~~~~~~~~~~~~$$$$$$$$$
//~~~~~~~~~~~~~~~$$$$$$$$$

function Runner() {
	this.isWin = /^win/.test(process.platform);
    this.child_process = require('child_process');
    this.runInherit = function(cmd, cmdArgs, cb) {

		if(this.isWin){
			if(cmd === "open"){
				cmd = "start";
			}
		}
        var msg = cmd;
        if(cmdArgs){
            for(var i=0; i<cmdArgs.length; i++) {
                msg += " "+cmdArgs[i];
            }
        }
        var spawn = this.child_process.spawn;
        spawn(cmd, cmdArgs, {stdio : 'inherit'});

        cb && cb();
    };

    this.run = function(cmd, cmdArgs, cb) {
        this._run(cmd, cmdArgs, null, cb);
    };

    this._run = function(cmd, cmdArgs, reader, cb) {
		if(this.isWin){
			if(cmd === "open"){
				cmd = "start";
			}
		}
        //console.log("RUNNING ", "[", cmd,  cmdArgs.join(" "), "]");
        var spawn = require('child_process').spawn,
        ls = spawn(cmd, cmdArgs);
        var out = "";
        var error = false;
        ls.stdout.on('data', function (data) {
            out += (data ? data.toString() : "");
            if(reader)
                reader.onData(data);
        });
        ls.stderr.on('data', function (data) {
            error = true;
            out += "\n" + (data ? data.toString() : "");
        });

        ls.on('close', function (code) {
            cb && cb(out, error);
        });
    };


}