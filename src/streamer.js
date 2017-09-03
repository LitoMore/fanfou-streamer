'use strict'

const {EventEmitter} = require('events')
const request = require('request')

const streamApiUser = 'http://stream.fanfou.com/1/user.json'
const apiCredentials = 'http://api.fanfou.com/account/verify_credentials.json'
// const requestTimeout = 5000

const TYPE_EVENT_GARBAGE = 'garbage'
const TYPE_EVENT_MESSAGE_CREATE = 'message.create'
// const TYPE_EVENT_MESSAGE_DELETE = 'message.delete'
const TYPE_EVENT_MESSAGE_REPLY = 'message.reply'
const TYPE_EVENT_MESSAGE_MENTION = 'message.mention'
const TYPE_EVENT_MESSAGE_REPOST = 'message.repost'
// const TYPE_EVENT_USER_UPDATEPROFILE = 'user.updateprofile'
// const TYPE_EVENT_FRIENDS_CREATE = 'friends.create'
// const TYPE_EVENT_FRIENDS_DELETE = 'friends.delete'
// const TYPE_EVENT_FRIENDS_REQUEST = 'friends.request'
// const TYPE_EVENT_FAV_CREATE = 'fav.create'
// const TYPE_EVENT_FAV_DELETE = 'fav.delete'

class Stream extends EventEmitter {
  constructor (fanfouSdkInstance) {
    if (!fanfouSdkInstance) {
      throw new Error('Need fanfou SDK Instance to proceed')
    }
    super()
    this.ff = fanfouSdkInstance
    this.user = null
    this.isStreaming = false
    this.streamHandle = null
    this.heartbeatTimeoutHandle = null
    this.chunk = ''
    this._start()
  }

  _start () {
    if (this.isStreaming) {
      return false
    }
    this.streamHandle = request(this.getReqOptions(streamApiUser, null, 'post'))
    this._addEventListners()
    this.getUser()
  }

  _stop () {
    console.log(`stopping streamer for ${this.user.id}`)
    this.streamHandle.destroy()
    this.streamHandle = null
    if (this.heartbeatTimeoutHandle) clearTimeout(this.heartbeatTimeoutHandle)
  }

  getUser () {
    request(this.getReqOptions(apiCredentials), (err, httpResponse, body) => {
      if (err) return false
      if (httpResponse.statusCode !== 200) return false
      try {
        this.user = JSON.parse(body)
      } catch (err) {
        //
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
    console.log(`stream request got response for ${this.user.id}, code `, response.statusCode)
    if (response.statusCode === 200) {
      this.isStreaming = true
      this.renewHeartbeatTimeout()
    }
    response.setEncoding('utf8')
    response.on('data', this._handleImData.bind(this))
    response.on('aborted', this._handleImAborted.bind(this))
    response.on('close', this._handleImClose.bind(this))
    response.on('end', this._handleImEnd.bind(this))
    response.on('error', this._handleImError.bind(this))
  }

  _handleRqError (args) {
    console.error(`RQ error for ${this.user.id}`, args)
    this.isStreaming = false
  }

  renewHeartbeatTimeout () {
    if (this.heartbeatTimeoutHandle) clearTimeout(this.heartbeatTimeoutHandle)
    this.heartbeatTimeoutHandle = null
    this.heartbeatTimeoutHandle = setTimeout(() => {
      this.isStreaming = false
      this._stop()
    }, 60 * 1000)
  }

  _handleImData (chunk) {
    this.chunk += chunk.toString('utf8')
    if (this.chunk === '\r\n') {
      console.log(`heartbeat for ${this.user.id}`, new Date())
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
          console.log(`new event for ${this.user.id}, type `, type, rawObj.object.text)
          this.emit(type, rawObj)
        } catch (e) {
          console.log(`new garbaged for ${this.user.id}, the cause was `, e.toString(), this.chunk)
          this.emit('garbage', this.chunk)
        }
        this.chunk = ''
      }
    }
  }

  _handleImAborted (args) {
    console.log(`IM aborted for ${this.user.id}`, args)
    this.isStreaming = false
  }

  _handleImClose (args) {
    console.log(`IM close for ${this.user.id}`, args)
    this.isStreaming = false
  }

  _handleImEnd (args) {
    console.log(`IM end for ${this.user.id}`, args)
    this.isStreaming = false
  }

  _handleImError (args) {
    console.log(`IM error for ${this.user.id}`, args)
    this.isStreaming = false
  }

  getReqOptions (uri, args = {}, method = 'get') {
    const oauth = {
      consumer_key: this.ff.consumer_key,
      consumer_secret: this.ff.consumer_secret,
      token: this.ff.oauth_token,
      token_secret: this.ff.oauth_token_secret
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
    /*
     * message.create
     * message.delete
     * message.replied
     * message.mentioned
     * user.updateprofile
     * friends.create
     * friends.delete
     * friends.request
     * fav.create
     * fav.delete
     */
    if (!rawObj.event) return TYPE_EVENT_GARBAGE
    if (rawObj.event === TYPE_EVENT_MESSAGE_CREATE) {
      if (rawObj.source.id !== this.user.id) {
        // mentioned,  or replied by other user
        if (rawObj.object.in_reply_to_user_id === this.user.id) {
          return TYPE_EVENT_MESSAGE_REPLY
        } else if (rawObj.object.repost_status_id && rawObj.object.repost_user_id === this.user.id) {
          return TYPE_EVENT_MESSAGE_REPOST
        } else {
          return TYPE_EVENT_MESSAGE_MENTION
        }
      } else {
        return TYPE_EVENT_MESSAGE_CREATE
      }
    } else {
      return rawObj.event
    }
  }
}

module.exports = Stream
