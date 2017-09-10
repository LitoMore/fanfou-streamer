# fanfou-streamer

[![](https://img.shields.io/travis/LitoMore/fanfou-streamer/master.svg)](https://travis-ci.org/LitoMore/fanfou-streamer)
[![](https://img.shields.io/npm/v/fanfou-streamer.svg)](https://www.npmjs.com/package/fanfou-streamer)
[![](https://img.shields.io/npm/l/fanfou-streamer.svg)](https://github.com/LitoMore/fanfou-streamer/blob/master/LICENSE)
[![](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Fanfou Streaming SDK for Node.js

## Install

```bash
$ npm install fanfou-streamer
```

## Usage

```javascript
const Streamer = require('fanfou-streamer')

const streamer = new Streamer({
  consumerKey: '',
  consumerSecret: '',
  oauthToken: '',
  oauthTokenSecret: ''
})

streamer.start()

streamer.on('message.reply', data => {
  console.log(data)
})

streamer.on('message.mention', data => {
  console.log(data)
})
```

## Events

- `message.create`
- `message.delete`
- `message.replied`
- `message.mentioned`
- `user.updateprofile`
- `friends.create`
- `friends.delete`
- `friends.request`
- `fav.create`
- `fav.delete`

## API

### `streamer.start()`

Start streaming.

### `streamer.stop()`

Stop streaming.

### `streamer.on(eventName, listener)`

Example:

```javascript
streamer.on('message.reply', data => {
  console.log(data)
})
```

## Related

- [fanfou-sdk](https://github.com/LitoMore/fanfou-sdk-node) - Fanfou SDK for Node.js
- [maofan-apn](https://github.com/LitoMore/maofan-apn) - APN service for Maofan

## License

MIT © [LitoMore](https://github.com/LitoMore)
