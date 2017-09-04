'use strict'

const test = require('ava')
const Streamer = require('./')

const {
  CONSUMER_KEY,
  CONSUMER_SECRET,
  OAUTH_TOKEN,
  OAUTH_TOKEN_SECRET
} = process.env

const PULL_REQUEST_FROM_FORKED = !(CONSUMER_KEY && CONSUMER_SECRET && OAUTH_TOKEN && OAUTH_TOKEN_SECRET)

const init = () => {
  process.streamer = new Streamer({
    consumerKey: CONSUMER_KEY,
    consumerSecret: CONSUMER_SECRET,
    oauthToken: OAUTH_TOKEN,
    oauthTokenSecret: OAUTH_TOKEN_SECRET
  })
}

const start = () => {
  return new Promise((resolve, reject) => {
    process.streamer.start()
    process.streamer.on('connected', () => resolve())
    setTimeout(() => {
      reject(new Error('Request timeout'))
    }, 20000)
  })
}

const stop = () => {
  return new Promise((resolve, reject) => {
    process.streamer.stop()
    process.streamer.on('disconnected', () => resolve())
    setTimeout(() => {
      reject(new Error('Request timeout'))
    }, 20000)
  })
}

test('create streamer', async t => {
  if (PULL_REQUEST_FROM_FORKED) t.pass()
  else {
    init()
    await start()
    t.is(process.streamer.isStreaming, true)
  }
})

test('stop streamer', async t => {
  if (PULL_REQUEST_FROM_FORKED) t.pass()
  else {
    await stop()
    t.is(process.streamer.isStreaming, false)
  }
})
