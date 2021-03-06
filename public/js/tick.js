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
