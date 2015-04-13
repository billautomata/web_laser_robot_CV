(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function () {
  "use strict";

  console.log('starting up')

  var tick = require('./tick.js')

  tick()

}

},{"./tick.js":3}],2:[function(require,module,exports){


var webcam = require('./webcam_load.js')
var init = require('./init.js')

window.onload = function(){
  console.log('window.onload')

  webcam()
  init()

}

},{"./init.js":1,"./webcam_load.js":4}],3:[function(require,module,exports){
module.exports = tick

var video = document.getElementById('webcam')

var canvas = document.getElementById('canvas')
var canvas_smaller = document.getElementById('canvas_smaller')
var canvas_smallest = document.getElementById('canvas_smallest')

var ctx = canvas.getContext('2d')
var ctx_smaller = canvas_smaller.getContext('2d')
var ctx_smallest = canvas_smallest.getContext('2d')

video.addEventListener('ended', function () {
  console.log('ended')
})

var w = 560
var h = 320

var curr_img_pyr = new window.jsfeat.pyramid_t(5);
curr_img_pyr.allocate(w, h, window.jsfeat.U8_t | window.jsfeat.C1_t)

var prev_img_pyr = new window.jsfeat.pyramid_t(5);
prev_img_pyr.allocate(w, h, window.jsfeat.U8_t | window.jsfeat.C1_t)

var last_frame = new window.jsfeat.matrix_t(w / 4, h / 4, window.jsfeat.U8_t | window.jsfeat.C1_t)
var diff_frame = new window.jsfeat.matrix_t(w / 4, h / 4, window.jsfeat.U8_t | window.jsfeat.C1_t)
var resize_frame = new window.jsfeat.matrix_t(w / 4, h / 4, window.jsfeat.U8_t | window.jsfeat.C1_t)

var most_active_position = {
  x: 0,
  y: 0,
  highest_value: 0,
  min_value: 10
}

var alpha = (0xff << 24)

function tick() {
  "use strict";

  // newframe
  if (video.readyState === video.HAVE_ENOUGH_DATA) {

    // draw the video to the canvas
    ctx.drawImage(video, 0, 0, w, h);
    // ctx_smaller.drawImage(video,0,0,w/4,h/4)

    // get the image data from the canvas
    var imageData = ctx.getImageData(0, 0, w, h);
    // console.log(imageData.length,w,h)

    // convert raw canvas data to new buffer in grayscale
    // convert imageData.data to curr_img_pyr.data[0]
    window.jsfeat.imgproc.grayscale(imageData.data, w, h, curr_img_pyr.data[0])

    curr_img_pyr.build(curr_img_pyr.data[0])

    // create a 32bit Integer view of the canvas.data.buffer
    // var data_u32 = new Uint32Array(imageData.data.buffer)

    // copy the grayscale data into the canvas imageData
    // var i = curr_img_pyr.data[0].cols * curr_img_pyr.data[0].rows
    // var pix = 0
    // while (--i >= 0) {
    //   pix = curr_img_pyr.data[0].buffer.u8[i]
    //   data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix
    // }
    // ctx.putImageData(imageData, 0, 0)

    var i
    var pix

    var depth = 4

    var imageData_sm = ctx_smaller.getImageData(0, 0, curr_img_pyr.data[depth].cols, curr_img_pyr.data[depth].rows)
    var sm_data_u32 = new Uint32Array(imageData_sm.data.buffer)

    // copy the reduced b&w buffer into the canvas image data : sm_data_u32
    // loop through the reduced b&w buffer
    // • calculate the difference from the last frame
    // • store the current value as the new last frame value
    // • copy the difference value to the imageData buffer (sm_data_u32)
    //    as a 32bit value
    i = curr_img_pyr.data[depth].cols * curr_img_pyr.data[depth].rows
    while (--i >= 0) {
      // pix = 8 bit value in the b&w buffer
      pix = curr_img_pyr.data[depth].buffer.u8[i]
      diff_frame.data[i] = Math.abs(last_frame.data[i] - pix) * 2
      last_frame.data[i] = pix
      pix = diff_frame.data[i]

      sm_data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix
    }
    ctx_smaller.putImageData(imageData_sm, 0, 0)

    // scan the columns of the canvas and output an array of activated values
    // that can be used to describe the activity from the camera
    // also find the most active x/y position

    most_active_position.highest_value = 0

    i = curr_img_pyr.data[depth].cols
    var j

    // create an empty array for each column
    var column_sums = Array(i - 1)
    for (let k = 0; k < i; k++) {
      column_sums[k] = 0.0
    }

    while (--i >= 0) {
      j = curr_img_pyr.data[depth].rows
      while (--j >= 0) {

        var idx = (j * curr_img_pyr.data[depth].cols) + i

        if(diff_frame.data[idx] > most_active_position.highest_value){

          if(diff_frame.data[idx] > most_active_position.min_value){
            most_active_position.highest_value = diff_frame.data[idx]
            most_active_position.x = i
            most_active_position.y = j
          }

        }

        column_sums[i] += diff_frame.data[idx]
      }
    }

    // draw the values in the columns to the canvas as rectangles
    column_sums.forEach(function (element, element_idx) {

      ctx_smaller.beginPath()
      ctx_smaller.rect(element_idx, curr_img_pyr.data[depth].rows - 1, 1, 1)
      ctx_smaller.fillStyle = 'rgb(0,0,' + element * 4 + ')'
      ctx_smaller.fill()
      ctx_smaller.closePath()

    })

    if(most_active_position.highest_value > most_active_position.min_value){
      var coords = []
      coords[0] = 1.0 -(most_active_position.x / curr_img_pyr.data[depth].cols)
      coords[1] = 1.0 -(most_active_position.y / curr_img_pyr.data[depth].rows)

      console.log('sending coords: ' + coords)
      window.socket.emit('pct', coords)

    }

    ctx_smaller.beginPath()
    ctx_smaller.rect(most_active_position.x, most_active_position.y, 1, 1)
    ctx_smaller.fillStyle = 'rgb(255,0,0)'
    ctx_smaller.fill()
    ctx_smaller.closePath()

  }

  window.requestAnimationFrame(tick)

}


Array.prototype.max = function () {
  return Math.max.apply(null, this);
};

},{}],4:[function(require,module,exports){
module.exports = function(){

  // lets do some fun
  var video = document.getElementById('webcam');
  var canvas = document.getElementById('canvas');
  try {
    var attempts = 0;
    var readyListener = function (event) {
      findVideoSize();
    };
    var findVideoSize = function () {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        video.removeEventListener('loadeddata', readyListener);
        // onDimensionsReady(video.videoWidth, video.videoHeight);
      } else {
        if (attempts < 10) {
          attempts++;
          setTimeout(findVideoSize, 200);
        } else {
          // onDimensionsReady(640, 480);
        }
      }
    };
    // var onDimensionsReady = function(width, height) {
    //   // demo_app(width, height);
    //   // compatibility.requestAnimationFrame(tick);
    // };

    video.addEventListener('loadeddata', readyListener);

    compatibility.getUserMedia({
      video: true
    }, function (stream) {

      try {
        video.src = compatibility.URL.createObjectURL(stream);
      } catch (error) {
        video.src = stream;
      }

      setTimeout(function () {
        video.play();
      }, 500);

    }, function (error) {
      console.log(error)
    });
  } catch (error) {
    console.log(error)
  }  


}

},{}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvaW5pdC5qcyIsInB1YmxpYy9qcy9tYWluLmpzIiwicHVibGljL2pzL3RpY2suanMiLCJwdWJsaWMvanMvd2ViY2FtX2xvYWQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIGNvbnNvbGUubG9nKCdzdGFydGluZyB1cCcpXG5cbiAgdmFyIHRpY2sgPSByZXF1aXJlKCcuL3RpY2suanMnKVxuXG4gIHRpY2soKVxuXG59XG4iLCJcblxudmFyIHdlYmNhbSA9IHJlcXVpcmUoJy4vd2ViY2FtX2xvYWQuanMnKVxudmFyIGluaXQgPSByZXF1aXJlKCcuL2luaXQuanMnKVxuXG53aW5kb3cub25sb2FkID0gZnVuY3Rpb24oKXtcbiAgY29uc29sZS5sb2coJ3dpbmRvdy5vbmxvYWQnKVxuXG4gIHdlYmNhbSgpXG4gIGluaXQoKVxuXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHRpY2tcblxudmFyIHZpZGVvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3dlYmNhbScpXG5cbnZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FudmFzJylcbnZhciBjYW52YXNfc21hbGxlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW52YXNfc21hbGxlcicpXG52YXIgY2FudmFzX3NtYWxsZXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbnZhc19zbWFsbGVzdCcpXG5cbnZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKVxudmFyIGN0eF9zbWFsbGVyID0gY2FudmFzX3NtYWxsZXIuZ2V0Q29udGV4dCgnMmQnKVxudmFyIGN0eF9zbWFsbGVzdCA9IGNhbnZhc19zbWFsbGVzdC5nZXRDb250ZXh0KCcyZCcpXG5cbnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgZnVuY3Rpb24gKCkge1xuICBjb25zb2xlLmxvZygnZW5kZWQnKVxufSlcblxudmFyIHcgPSA1NjBcbnZhciBoID0gMzIwXG5cbnZhciBjdXJyX2ltZ19weXIgPSBuZXcgd2luZG93LmpzZmVhdC5weXJhbWlkX3QoNSk7XG5jdXJyX2ltZ19weXIuYWxsb2NhdGUodywgaCwgd2luZG93LmpzZmVhdC5VOF90IHwgd2luZG93LmpzZmVhdC5DMV90KVxuXG52YXIgcHJldl9pbWdfcHlyID0gbmV3IHdpbmRvdy5qc2ZlYXQucHlyYW1pZF90KDUpO1xucHJldl9pbWdfcHlyLmFsbG9jYXRlKHcsIGgsIHdpbmRvdy5qc2ZlYXQuVThfdCB8IHdpbmRvdy5qc2ZlYXQuQzFfdClcblxudmFyIGxhc3RfZnJhbWUgPSBuZXcgd2luZG93LmpzZmVhdC5tYXRyaXhfdCh3IC8gNCwgaCAvIDQsIHdpbmRvdy5qc2ZlYXQuVThfdCB8IHdpbmRvdy5qc2ZlYXQuQzFfdClcbnZhciBkaWZmX2ZyYW1lID0gbmV3IHdpbmRvdy5qc2ZlYXQubWF0cml4X3QodyAvIDQsIGggLyA0LCB3aW5kb3cuanNmZWF0LlU4X3QgfCB3aW5kb3cuanNmZWF0LkMxX3QpXG52YXIgcmVzaXplX2ZyYW1lID0gbmV3IHdpbmRvdy5qc2ZlYXQubWF0cml4X3QodyAvIDQsIGggLyA0LCB3aW5kb3cuanNmZWF0LlU4X3QgfCB3aW5kb3cuanNmZWF0LkMxX3QpXG5cbnZhciBtb3N0X2FjdGl2ZV9wb3NpdGlvbiA9IHtcbiAgeDogMCxcbiAgeTogMCxcbiAgaGlnaGVzdF92YWx1ZTogMCxcbiAgbWluX3ZhbHVlOiAxMFxufVxuXG52YXIgYWxwaGEgPSAoMHhmZiA8PCAyNClcblxuZnVuY3Rpb24gdGljaygpIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgLy8gbmV3ZnJhbWVcbiAgaWYgKHZpZGVvLnJlYWR5U3RhdGUgPT09IHZpZGVvLkhBVkVfRU5PVUdIX0RBVEEpIHtcblxuICAgIC8vIGRyYXcgdGhlIHZpZGVvIHRvIHRoZSBjYW52YXNcbiAgICBjdHguZHJhd0ltYWdlKHZpZGVvLCAwLCAwLCB3LCBoKTtcbiAgICAvLyBjdHhfc21hbGxlci5kcmF3SW1hZ2UodmlkZW8sMCwwLHcvNCxoLzQpXG5cbiAgICAvLyBnZXQgdGhlIGltYWdlIGRhdGEgZnJvbSB0aGUgY2FudmFzXG4gICAgdmFyIGltYWdlRGF0YSA9IGN0eC5nZXRJbWFnZURhdGEoMCwgMCwgdywgaCk7XG4gICAgLy8gY29uc29sZS5sb2coaW1hZ2VEYXRhLmxlbmd0aCx3LGgpXG5cbiAgICAvLyBjb252ZXJ0IHJhdyBjYW52YXMgZGF0YSB0byBuZXcgYnVmZmVyIGluIGdyYXlzY2FsZVxuICAgIC8vIGNvbnZlcnQgaW1hZ2VEYXRhLmRhdGEgdG8gY3Vycl9pbWdfcHlyLmRhdGFbMF1cbiAgICB3aW5kb3cuanNmZWF0LmltZ3Byb2MuZ3JheXNjYWxlKGltYWdlRGF0YS5kYXRhLCB3LCBoLCBjdXJyX2ltZ19weXIuZGF0YVswXSlcblxuICAgIGN1cnJfaW1nX3B5ci5idWlsZChjdXJyX2ltZ19weXIuZGF0YVswXSlcblxuICAgIC8vIGNyZWF0ZSBhIDMyYml0IEludGVnZXIgdmlldyBvZiB0aGUgY2FudmFzLmRhdGEuYnVmZmVyXG4gICAgLy8gdmFyIGRhdGFfdTMyID0gbmV3IFVpbnQzMkFycmF5KGltYWdlRGF0YS5kYXRhLmJ1ZmZlcilcblxuICAgIC8vIGNvcHkgdGhlIGdyYXlzY2FsZSBkYXRhIGludG8gdGhlIGNhbnZhcyBpbWFnZURhdGFcbiAgICAvLyB2YXIgaSA9IGN1cnJfaW1nX3B5ci5kYXRhWzBdLmNvbHMgKiBjdXJyX2ltZ19weXIuZGF0YVswXS5yb3dzXG4gICAgLy8gdmFyIHBpeCA9IDBcbiAgICAvLyB3aGlsZSAoLS1pID49IDApIHtcbiAgICAvLyAgIHBpeCA9IGN1cnJfaW1nX3B5ci5kYXRhWzBdLmJ1ZmZlci51OFtpXVxuICAgIC8vICAgZGF0YV91MzJbaV0gPSBhbHBoYSB8IChwaXggPDwgMTYpIHwgKHBpeCA8PCA4KSB8IHBpeFxuICAgIC8vIH1cbiAgICAvLyBjdHgucHV0SW1hZ2VEYXRhKGltYWdlRGF0YSwgMCwgMClcblxuICAgIHZhciBpXG4gICAgdmFyIHBpeFxuXG4gICAgdmFyIGRlcHRoID0gNFxuXG4gICAgdmFyIGltYWdlRGF0YV9zbSA9IGN0eF9zbWFsbGVyLmdldEltYWdlRGF0YSgwLCAwLCBjdXJyX2ltZ19weXIuZGF0YVtkZXB0aF0uY29scywgY3Vycl9pbWdfcHlyLmRhdGFbZGVwdGhdLnJvd3MpXG4gICAgdmFyIHNtX2RhdGFfdTMyID0gbmV3IFVpbnQzMkFycmF5KGltYWdlRGF0YV9zbS5kYXRhLmJ1ZmZlcilcblxuICAgIC8vIGNvcHkgdGhlIHJlZHVjZWQgYiZ3IGJ1ZmZlciBpbnRvIHRoZSBjYW52YXMgaW1hZ2UgZGF0YSA6IHNtX2RhdGFfdTMyXG4gICAgLy8gbG9vcCB0aHJvdWdoIHRoZSByZWR1Y2VkIGImdyBidWZmZXJcbiAgICAvLyDigKIgY2FsY3VsYXRlIHRoZSBkaWZmZXJlbmNlIGZyb20gdGhlIGxhc3QgZnJhbWVcbiAgICAvLyDigKIgc3RvcmUgdGhlIGN1cnJlbnQgdmFsdWUgYXMgdGhlIG5ldyBsYXN0IGZyYW1lIHZhbHVlXG4gICAgLy8g4oCiIGNvcHkgdGhlIGRpZmZlcmVuY2UgdmFsdWUgdG8gdGhlIGltYWdlRGF0YSBidWZmZXIgKHNtX2RhdGFfdTMyKVxuICAgIC8vICAgIGFzIGEgMzJiaXQgdmFsdWVcbiAgICBpID0gY3Vycl9pbWdfcHlyLmRhdGFbZGVwdGhdLmNvbHMgKiBjdXJyX2ltZ19weXIuZGF0YVtkZXB0aF0ucm93c1xuICAgIHdoaWxlICgtLWkgPj0gMCkge1xuICAgICAgLy8gcGl4ID0gOCBiaXQgdmFsdWUgaW4gdGhlIGImdyBidWZmZXJcbiAgICAgIHBpeCA9IGN1cnJfaW1nX3B5ci5kYXRhW2RlcHRoXS5idWZmZXIudThbaV1cbiAgICAgIGRpZmZfZnJhbWUuZGF0YVtpXSA9IE1hdGguYWJzKGxhc3RfZnJhbWUuZGF0YVtpXSAtIHBpeCkgKiAyXG4gICAgICBsYXN0X2ZyYW1lLmRhdGFbaV0gPSBwaXhcbiAgICAgIHBpeCA9IGRpZmZfZnJhbWUuZGF0YVtpXVxuXG4gICAgICBzbV9kYXRhX3UzMltpXSA9IGFscGhhIHwgKHBpeCA8PCAxNikgfCAocGl4IDw8IDgpIHwgcGl4XG4gICAgfVxuICAgIGN0eF9zbWFsbGVyLnB1dEltYWdlRGF0YShpbWFnZURhdGFfc20sIDAsIDApXG5cbiAgICAvLyBzY2FuIHRoZSBjb2x1bW5zIG9mIHRoZSBjYW52YXMgYW5kIG91dHB1dCBhbiBhcnJheSBvZiBhY3RpdmF0ZWQgdmFsdWVzXG4gICAgLy8gdGhhdCBjYW4gYmUgdXNlZCB0byBkZXNjcmliZSB0aGUgYWN0aXZpdHkgZnJvbSB0aGUgY2FtZXJhXG4gICAgLy8gYWxzbyBmaW5kIHRoZSBtb3N0IGFjdGl2ZSB4L3kgcG9zaXRpb25cblxuICAgIG1vc3RfYWN0aXZlX3Bvc2l0aW9uLmhpZ2hlc3RfdmFsdWUgPSAwXG5cbiAgICBpID0gY3Vycl9pbWdfcHlyLmRhdGFbZGVwdGhdLmNvbHNcbiAgICB2YXIgalxuXG4gICAgLy8gY3JlYXRlIGFuIGVtcHR5IGFycmF5IGZvciBlYWNoIGNvbHVtblxuICAgIHZhciBjb2x1bW5fc3VtcyA9IEFycmF5KGkgLSAxKVxuICAgIGZvciAobGV0IGsgPSAwOyBrIDwgaTsgaysrKSB7XG4gICAgICBjb2x1bW5fc3Vtc1trXSA9IDAuMFxuICAgIH1cblxuICAgIHdoaWxlICgtLWkgPj0gMCkge1xuICAgICAgaiA9IGN1cnJfaW1nX3B5ci5kYXRhW2RlcHRoXS5yb3dzXG4gICAgICB3aGlsZSAoLS1qID49IDApIHtcblxuICAgICAgICB2YXIgaWR4ID0gKGogKiBjdXJyX2ltZ19weXIuZGF0YVtkZXB0aF0uY29scykgKyBpXG5cbiAgICAgICAgaWYoZGlmZl9mcmFtZS5kYXRhW2lkeF0gPiBtb3N0X2FjdGl2ZV9wb3NpdGlvbi5oaWdoZXN0X3ZhbHVlKXtcblxuICAgICAgICAgIGlmKGRpZmZfZnJhbWUuZGF0YVtpZHhdID4gbW9zdF9hY3RpdmVfcG9zaXRpb24ubWluX3ZhbHVlKXtcbiAgICAgICAgICAgIG1vc3RfYWN0aXZlX3Bvc2l0aW9uLmhpZ2hlc3RfdmFsdWUgPSBkaWZmX2ZyYW1lLmRhdGFbaWR4XVxuICAgICAgICAgICAgbW9zdF9hY3RpdmVfcG9zaXRpb24ueCA9IGlcbiAgICAgICAgICAgIG1vc3RfYWN0aXZlX3Bvc2l0aW9uLnkgPSBqXG4gICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBjb2x1bW5fc3Vtc1tpXSArPSBkaWZmX2ZyYW1lLmRhdGFbaWR4XVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGRyYXcgdGhlIHZhbHVlcyBpbiB0aGUgY29sdW1ucyB0byB0aGUgY2FudmFzIGFzIHJlY3RhbmdsZXNcbiAgICBjb2x1bW5fc3Vtcy5mb3JFYWNoKGZ1bmN0aW9uIChlbGVtZW50LCBlbGVtZW50X2lkeCkge1xuXG4gICAgICBjdHhfc21hbGxlci5iZWdpblBhdGgoKVxuICAgICAgY3R4X3NtYWxsZXIucmVjdChlbGVtZW50X2lkeCwgY3Vycl9pbWdfcHlyLmRhdGFbZGVwdGhdLnJvd3MgLSAxLCAxLCAxKVxuICAgICAgY3R4X3NtYWxsZXIuZmlsbFN0eWxlID0gJ3JnYigwLDAsJyArIGVsZW1lbnQgKiA0ICsgJyknXG4gICAgICBjdHhfc21hbGxlci5maWxsKClcbiAgICAgIGN0eF9zbWFsbGVyLmNsb3NlUGF0aCgpXG5cbiAgICB9KVxuXG4gICAgaWYobW9zdF9hY3RpdmVfcG9zaXRpb24uaGlnaGVzdF92YWx1ZSA+IG1vc3RfYWN0aXZlX3Bvc2l0aW9uLm1pbl92YWx1ZSl7XG4gICAgICB2YXIgY29vcmRzID0gW11cbiAgICAgIGNvb3Jkc1swXSA9IDEuMCAtKG1vc3RfYWN0aXZlX3Bvc2l0aW9uLnggLyBjdXJyX2ltZ19weXIuZGF0YVtkZXB0aF0uY29scylcbiAgICAgIGNvb3Jkc1sxXSA9IDEuMCAtKG1vc3RfYWN0aXZlX3Bvc2l0aW9uLnkgLyBjdXJyX2ltZ19weXIuZGF0YVtkZXB0aF0ucm93cylcblxuICAgICAgY29uc29sZS5sb2coJ3NlbmRpbmcgY29vcmRzOiAnICsgY29vcmRzKVxuICAgICAgd2luZG93LnNvY2tldC5lbWl0KCdwY3QnLCBjb29yZHMpXG5cbiAgICB9XG5cbiAgICBjdHhfc21hbGxlci5iZWdpblBhdGgoKVxuICAgIGN0eF9zbWFsbGVyLnJlY3QobW9zdF9hY3RpdmVfcG9zaXRpb24ueCwgbW9zdF9hY3RpdmVfcG9zaXRpb24ueSwgMSwgMSlcbiAgICBjdHhfc21hbGxlci5maWxsU3R5bGUgPSAncmdiKDI1NSwwLDApJ1xuICAgIGN0eF9zbWFsbGVyLmZpbGwoKVxuICAgIGN0eF9zbWFsbGVyLmNsb3NlUGF0aCgpXG5cbiAgfVxuXG4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljaylcblxufVxuXG5cbkFycmF5LnByb3RvdHlwZS5tYXggPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBNYXRoLm1heC5hcHBseShudWxsLCB0aGlzKTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCl7XG5cbiAgLy8gbGV0cyBkbyBzb21lIGZ1blxuICB2YXIgdmlkZW8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2ViY2FtJyk7XG4gIHZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FudmFzJyk7XG4gIHRyeSB7XG4gICAgdmFyIGF0dGVtcHRzID0gMDtcbiAgICB2YXIgcmVhZHlMaXN0ZW5lciA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgZmluZFZpZGVvU2l6ZSgpO1xuICAgIH07XG4gICAgdmFyIGZpbmRWaWRlb1NpemUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAodmlkZW8udmlkZW9XaWR0aCA+IDAgJiYgdmlkZW8udmlkZW9IZWlnaHQgPiAwKSB7XG4gICAgICAgIHZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWRlZGRhdGEnLCByZWFkeUxpc3RlbmVyKTtcbiAgICAgICAgLy8gb25EaW1lbnNpb25zUmVhZHkodmlkZW8udmlkZW9XaWR0aCwgdmlkZW8udmlkZW9IZWlnaHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGF0dGVtcHRzIDwgMTApIHtcbiAgICAgICAgICBhdHRlbXB0cysrO1xuICAgICAgICAgIHNldFRpbWVvdXQoZmluZFZpZGVvU2l6ZSwgMjAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBvbkRpbWVuc2lvbnNSZWFkeSg2NDAsIDQ4MCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICAgIC8vIHZhciBvbkRpbWVuc2lvbnNSZWFkeSA9IGZ1bmN0aW9uKHdpZHRoLCBoZWlnaHQpIHtcbiAgICAvLyAgIC8vIGRlbW9fYXBwKHdpZHRoLCBoZWlnaHQpO1xuICAgIC8vICAgLy8gY29tcGF0aWJpbGl0eS5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgLy8gfTtcblxuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZGRhdGEnLCByZWFkeUxpc3RlbmVyKTtcblxuICAgIGNvbXBhdGliaWxpdHkuZ2V0VXNlck1lZGlhKHtcbiAgICAgIHZpZGVvOiB0cnVlXG4gICAgfSwgZnVuY3Rpb24gKHN0cmVhbSkge1xuXG4gICAgICB0cnkge1xuICAgICAgICB2aWRlby5zcmMgPSBjb21wYXRpYmlsaXR5LlVSTC5jcmVhdGVPYmplY3RVUkwoc3RyZWFtKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHZpZGVvLnNyYyA9IHN0cmVhbTtcbiAgICAgIH1cblxuICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZpZGVvLnBsYXkoKTtcbiAgICAgIH0sIDUwMCk7XG5cbiAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUubG9nKGVycm9yKVxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUubG9nKGVycm9yKVxuICB9ICBcblxuXG59XG4iXX0=
