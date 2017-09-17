'use strict'

const {EventEmitter} = require('events')
const request = require('request')

const streamApiUser = 'http://stream.fanfou.com/1/user.json'
const apiCredentials = 'http://api.fanfou.com/account/verify_credentials.json'

const TYPE_EVENT_GARBAGE = 'garbage'

class Stream extends EventEmitter {
  constructor (oauth, options = {}) {
    if (!oauth) {
      throw new Error('Need OAuth to proceed')
    }
    super()
    this.oauth = oauth
    this.user = null
    this.isStreaming = false
    this.streamHandle = null
    this.responseHandle = null
    this.heartbeatTimeoutDuration = 40 * 1000
    this.heartbeatTimeoutHandle = null
    this.autoReconnect = (typeof options.autoReconnect === 'boolean') ? options.autoReconnect : true
    this.chunk = ''
  }

  start () {
    if (this.isStreaming) {
      return false
    }
    this.getUser(err => {
      if (!err) {
        this.streamHandle = request(this.getReqOptions(streamApiUser, null, 'post'))
        this._addEventListners()
      } else {
        // console.error('failed to fectch user info', err)
      }
    })
  }

  stop () {
    // console.log(`stopping streamer for ${this.user.id}`)
    this.responseHandle.destroy()
    this.responseHandle = null
    this.streamHandle.destroy()
    this.streamHandle = null
    if (this.heartbeatTimeoutHandle) clearTimeout(this.heartbeatTimeoutHandle)
  }

  getUser (callback) {
    request(this.getReqOptions(apiCredentials), (err, httpResponse, body) => {
      if (err) return false
      if (httpResponse.statusCode !== 200) return false
      try {
        this.user = JSON.parse(body)
        if (typeof callback === 'function') callback(null)
      } catch (err) {
        if (typeof callback === 'function') callback(err)
      }
    })
  }

  _addEventListners () {
    if (!this.streamHandle) {
      return false
    }
    this.streamHandle.on('response', this._handleRqResponse.bind(this))
    this.streamHandle.on('error', this._handleRqError.bind(this))
  }

  _handleRqResponse (response) {
    // console.log(`stream request got response for ${this.user.id}, code `, response.statusCode)
    this.responseHandle = response
    if (this.responseHandle.statusCode === 200) {
      this.isStreaming = true
      this.renewHeartbeatTimeout()
      this.emit('connected')
    }
    this.responseHandle.setEncoding('utf8')
    // "Im" for IncomingMessage
    this.responseHandle.on('data', this._handleImData.bind(this))
    this.responseHandle.on('aborted', this._handleImAborted.bind(this))
    this.responseHandle.on('close', this._handleImClose.bind(this))
    this.responseHandle.on('end', this._handleImEnd.bind(this))
    this.responseHandle.on('error', this._handleImError.bind(this))
  }

  _handleRqError (args) {
    // console.error(`RQ error for ${this.user.id}`, args)
    this._setDisconnected()
  }

  renewHeartbeatTimeout () {
    if (this.heartbeatTimeoutHandle) clearTimeout(this.heartbeatTimeoutHandle)
    this.heartbeatTimeoutHandle = null
    this.heartbeatTimeoutHandle = setTimeout(() => {
      // console.log(`heartbeat timed out for ${this.user.id}, stopping...`)
      this.isStreaming = false
      this.stop()
      if (this.autoReconnect === true) {
        // console.log(`auto reconnecting for ${this.user.id}...`)
        this.start()
      }
    }, this.heartbeatTimeoutDuration)
  }

  _handleImData (chunk) {
    this.chunk += chunk.toString('utf8')
    if (this.chunk === '\r\n') {
      // console.log(`heartbeat for ${this.user.id}`, new Date())
      // normal interval is 20s
      this.renewHeartbeatTimeout()
      this.emit('heartbeat')
      return false
    }
    let index, json
    while ((index = this.chunk.indexOf('\r\n')) > -1) {
      json = this.chunk.slice(0, index)
      this.chunk = this.chunk.slice(index + 2)
      if (json.length > 0) {
        try {
          let rawObj = JSON.parse(json)
          let type = this.getType(rawObj)
          // console.log(`new event for ${this.user.id}, type `, type, rawObj.object.text)
          this.emit(type, rawObj)
        } catch (e) {
          // console.log(`new garbaged for ${this.user.id}, the cause was `, e.toString(), json)
          this.emit('garbage', this.chunk)
        }
        this.chunk = ''
      }
    }
  }

  _handleImAborted () {
    this._setDisconnected()
  }

  _handleImClose () {
    this._setDisconnected()
  }

  _handleImEnd () {
    this._setDisconnected()
  }

  _handleImError (args) {
    this._setDisconnected()
  }

  getReqOptions (uri, args = {}, method = 'get') {
    const oauth = {
      consumer_key: this.oauth.consumerKey,
      consumer_secret: this.oauth.consumerSecret,
      token: this.oauth.oauthToken,
      token_secret: this.oauth.oauthTokenSecret
    }
    let options = {
      uri,
      method,
      args,
      oauth
    }
    return options
  }

  getType (rawObj) {
    if (!rawObj.event) return TYPE_EVENT_GARBAGE
    switch (rawObj.event) {
      case 'message.create':
        if (rawObj.source.id !== this.user.id) {
          if (rawObj.object.in_reply_to_user_id === this.user.id) return 'message.reply'
          else if (rawObj.object.repost_status_id && rawObj.object.repost_user_id === this.user.id) return 'message.repost'
          else return 'message.mention'
        }
        break
      case 'fav.create':
      case 'fav.delete':
        if (rawObj.object.user && rawObj.object.user.id === this.user.id) return rawObj.event
        break
      case 'dm.create':
      case 'friends.create':
      case 'friends.request':
        if (rawObj.target && rawObj.target.id === this.user.id) return rawObj.event
        break
      default:
        return rawObj.event
    }
    return TYPE_EVENT_GARBAGE
  }

  _setDisconnected () {
    this.isStreaming = false
    this.emit('disconnected')
  }
}

module.exports = Stream
