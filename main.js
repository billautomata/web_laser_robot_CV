



var fs = require('fs'),
    http = require('http'),
    https = require('https'),
    express = require('express');

var socket_client = require('socket.io-client')('http://localhost:8000');
socket_client.on('connect', function(){
    console.log('connected')
});
socket_client.on('event', function(data){});
socket_client.on('disconnect', function(){});



var port = 8001;

var options = {
    key: fs.readFileSync('./nginx.key'),
    cert: fs.readFileSync('./nginx.crt'),
    requestCert: false,
    rejectUnauthorized: false
};

var app = express();

var server = https.createServer(options, app).listen(port, function(){
  console.log("Express server listening on port " + port);
});

var io = require('socket.io')(server);

// app.get('/', function (req, res) {
//     res.writeHead(200);
//     res.end("hello world\n");
// });

app.use(express.static(__dirname + '/public'))


io.on('connection', function (socket) {

  console.log('client connected ' + socket.id)

  socket.on('pct', function(d){
    console.log('got ' + d + ' sending it to the robot')
    socket_client.emit('coords_pct', d)
  })

})
