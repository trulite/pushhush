(function () {
    'use strict';
    
    var error_types, failed_message, log, net, options, passed_message, program, readBuffer, trace, version, winston, _;
    
    net = require('net');
    
    program = require('commander');
    
    winston = require('winston');
    
    _ = require('underscore');
    
    version = '0.0.3';
    
    program.version(version)
    .option('-d, --debug', 'Show various internal messages', false)
    .option('-l, --latency [milliseconds]', 'Simlated processing latency', 100)
    .option('-x, --latency-flux [number]', 'Random number from 0..flux to add to latency to simulate variance', 100)
    .option('-p, --port [number]', 'Port to listen on.', 445)
    .parse(process.argv);
    
    log = new winston.Logger({
      transports: [
        new (winston.transports.File)({ filename: 'mockapns.log' , timestamp: true, handleExceptions: true})
      ]
    });
    
    console.log("^^^^ PushHush v" + version + ". Mock APNS. ^^^^");
    
    if (program.debug !== null) {
      console.log("* Debug mode.");
    }
    
    log.info("Starting with f:" + program.failureRatio + " l:" + program.latency + " x:" + program.latencyFlux);
    
    error_types = [8, 255];
    
    failed_message = function() {
      return {
        error: _.find(error_types, function() {
          return error_types[Math.floor(Math.random() * error_types.length)];
        })
      };
    };
    
    passed_message = function() {
      return 0;
    };
    
    trace = function(x, msg) {
      return log.info("[" + x + "] " + msg);
    };

    // Parse the buffer per the APNS protocol
    readBuffer = function(data, x) {

        var command,id, expiry, offset = 0, payload, payloadLength, pBuf, tempBuf, token, tokenLength;
                
        // Command byte 
        command = data.readUInt8(offset);
        trace(x, "Command: "+command);
        offset++;
        
        // Handle enhanced mode
        if( command == 1 ) {
            // Identifier
            id = data.readUInt32BE(offset);
            offset += 4;
            
            // Expiration
            expiry = data.readUInt32BE(offset);
            offset += 4;
        }
        
        // Token length
        tokenLength = data.readUInt16BE(offset);
        offset += 2;
        
        // Token
        tempBuf = new Buffer(tokenLength);
        data.copy(tempBuf, 0, offset, offset+tokenLength);
        token = tempBuf.toString();
        offset += tokenLength;
        
        // Payload length
        payloadLength = data.readUInt16BE(offset);
        offset += 2;
        
        // Payload
        pBuf = new Buffer(payloadLength);
        data.copy(pBuf, 0, offset, offset+payloadLength);
        payload = pBuf.toString();
    };
    
    // Need this option so the client doesn't close 
    // the connection on sending a FIN
    options = {allowHalfOpen:true};
    
    // Create a server and listen for connections
    net.createServer(options, function(sock) {
    
        var allData = [], cb, latency, x;
        x = "x-" + (Math.floor(Math.random() * 1e6));

        cb = function() {
            trace(x, "Sending out data.");
            return sock.write('0');
        };
                    
        sock.on('data', function(data) {    
            // Keep pushing data on to a temp array
            allData.push(data);
        });
    
        sock.on('end', function() {
            try {
            // Read buffers of data, one at a time
                for( var i in allData ) {
                    readBuffer(allData[i]);
                }
    
                if (program.latency > 0) {
                    latency = program.latency + (Math.floor(Math.random() * program.latencyFlux));
                    trace(x, "Simulate: Latency of " + latency + "ms.");
                    return setTimeout(cb, latency);
                } else {
                    return cb();
                }
            } catch(e) {
                sock.write('1');
            }
    
            sock.end();
        });
    
    }).listen(program.port, function (){
        console.log("* Listening on port " + program.port + ".");
    });


}).call(this);