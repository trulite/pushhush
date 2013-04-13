(function () {
    'use strict';
    
    var app, certificate, error_types, express, failed_message, fs, 
        https, log, options, passed_message, privateKey, program, sys, trace, version, winston, _;

    express = require('express');

    fs = require('fs');

    sys = require('sys');

    program = require('commander');

    https = require("https");

    winston = require('winston');

    _ = require('underscore');

    version = '0.0.1';

    program.version(version)
    .option('-d, --debug', 'Show various internal messages', false)
    .option('-c, --crash-ratio [float]', 'Crash ratio 0 to 1 to. e.g. 0.2 to indicate 20% of requests end with 500', 0)
    .option('-f, --failure-ratio [float]', 'Failure ratio, 0 to 1. e.g. 0.3 to indicate 30% of IDs are failures', 0)
    .option('-l, --latency [milliseconds]', 'Simlated processing latency', 100)
    .option('-x, --latency-flux [number]', 'Random number from 0..flux to add to latency to simulate variance', 100)    
    .option('-p, --port [number]', 'Port to listen on.', 7333)
    .parse(process.argv);
    
    
    log = new winston.Logger({
      transports: [
        new (winston.transports.Console)({
          timestamp: true,
          handleExceptions: true
        }),
        new (winston.transports.File)({ filename: 'mockgcm.log' })
      ]
    });

    console.log("^^^^ PushHush v" + version + ". Mock GCM. ^^^^");

    if (program.debug !== null) {
      console.log("* Debug mode.");
    }

    console.log("* Listening on port " + program.port + ".");

    log.info("Starting with f:" + program.failureRatio + " l:" + program.latency);
    log.info(" x:" + program.latencyFlux + " c:" + program.crashRatio);

    app = express({
      key: privateKey,
      cert: certificate
    });

    app.use(express.bodyParser());

    error_types = ['NotRegistered', 'MismatchSenderId'];

    failed_message = function() {
      return {
        error: _.find(error_types, function() {
          return error_types[Math.floor(Math.random() * error_types.length)];
        })
      };
    };

    passed_message = function() {
      return {
        message_id: "0:" + (Math.floor(Math.random() * 1e16)) + "%000000000000babe"
      };
    };

    trace = function(x, msg) {
      return log.info("[" + x + "] " + msg);
    };

    app.post('/*', function(req, res) {
        var cb, data, failed, h, idcount, latency, origin_addr, passed, x;
        
        if(req.body.registration_ids){
           idcount = req.body.registration_ids.length;
        }else{
            idcount = 1;
        }
    
        failed = Math.floor(program.failureRatio * idcount);
        passed = idcount - failed;
    
        x = "x-" + (Math.floor(Math.random() * 1e6));
    
        res.header('x-pushhush-id', x);
    
        if (req.headers && (h = req.headers['x-forwarded-for'])) {
            origin_addr = h;
        } else {
            origin_addr = req.connection.remoteAddress;
        }
        
        trace(x, "Originator: " + origin_addr);
        trace(x, "Accepted " + idcount + " regids. " + failed + " should fail and " + passed + " should pass.");
    
        if (req.body.collapse_key) {
            trace(x, "Collapse key: [" + req.body.collapse_key + "]");
        }   
        
        if (req.body.data) {
            trace(x, "Data ===");
            trace(x, "" + (JSON.stringify(req.body.data)));
            trace(x, "========");
        }
        
        data = {
            multicast_id: Math.random() * 1e19,
            success: passed,
            failure: failed,
            canonical_ids: 0,
            results: []
        };
        
        _.times(failed, function() {
            return data.results.push(failed_message());
        });
        
        _.times(passed, function() {
            return data.results.push(passed_message());
        });
        
        data.results = _.shuffle(data.results);
    
        cb = function() {
            trace(x, "Sending out data.");
            return res.send(data);
        };
        
        if (Math.random() < program.crashRatio) {
            trace(x, "Simulate: Crashing.");
            return res.send(500, "");
        } else if (program.latency > 0) {
            latency = program.latency + (Math.floor(Math.random() * program.latencyFlux));
            trace(x, "Simulate: Latency of " + latency + "ms.");
            return setTimeout(cb, latency);
        } else {
            return cb();
        }
        
    });

    app.listen(program.port);

    privateKey = fs.readFileSync('privatekey.pem').toString();

    certificate = fs.readFileSync('certificate.pem').toString();

    options = {
      key: privateKey,
      cert: certificate
    };

    https.createServer(options, function(req, res) {
      return app.handle(req, res);
    }).listen(443, function (){
        console.log("* Started server on port 443 *");
    });

}).call(this);