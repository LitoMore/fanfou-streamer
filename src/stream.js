'use strict'

const Fanfou = require('fanfou-sdk')
const {EventEmitter} = require('events')

class Stream extends EventEmitter {
  constructor (options) {
    super()
    this.ff = new Fanfou(options)
  }
}

module.exports = Stream
