"use strict";

var redis = require('redis')
var lru = require('redis-lru')

function RedisApiCache(options) {
  this.redis = redis.createClient(
    options.port, 
    options.host, 
    options.redisOptions
  )
  this.lru = lru(this.redis, {
    max: options.max, score: () => 1, increment: true
  })
  this.debug = !!options.debug
}

RedisApiCache.prototype = {
  isExpired: function(key, cb) {
    var ctx = this
    ctx.debug && console.log("isExpired?", key)
    this.lru.get(key, false).then(function(maybeEntry) {
      ctx.debug && console.log("isExpired!", key, maybeEntry)
      if(maybeEntry) {
        cb && cb(false)
      } else {
        cb && cb(true)
      }
    })
  },
  get: function(key, cb) {
    var ctx = this
    ctx.debug && console.log("get?", key)
    this.lru.get(key).then(function(maybeEntry) {
      ctx.debug && console.log("get!", key, maybeEntry)
      if(maybeEntry) {
        cb && cb(null, maybeEntry)
      } else {
        cb && cb(null)
      }
    })   
  },
  set: function(key, value, ttl, cb) {
    var ctx = this
    ctx.debug && console.log("set?", key)
    this.lru.set(key, value, (ttl ? (Date.now() + (ttl * 1000)) : 100000)).then(function(result) {
      ctx.debug && console.log("set!", key)
      cb && cb(null)
    })
    
  },
  remove: function(key, cb) {
    var ctx = this
    this.debug && console.log("remove?", key)
    this.lru.get(key).then(function() {
      ctx.lru.del(key).then(function(result) {
        ctx.debug && console.log("remove!", key, result)
        cb && cb(null)
      })
    })
  },
  clear: function(cb) {
    var ctx = this
    ctx.debug && console.log("clear?")
    this.lru.reset().then(function(result) {
      ctx.debug && console.log("clear!")
      cb && cb(null)
    })
  }
};
module.exports = RedisApiCache;