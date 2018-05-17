"use strict";
const redis = require('redis')
const Prismic = require('prismic-javascript')
const RedisApiCache = require('./RedisApiCache')

var redisPubClient;
var redisSubClient;

function RedisCachedPrismicApi(prismicApiEndpoint, redisSettings) {
  const ctx = this
  this.prismicApiEndpoint = prismicApiEndpoint
  this.redisSettings = redisSettings
  this.setupRedisClients()
  this.setupCache()
  this.fetch()
}

RedisCachedPrismicApi.prototype = {
  setupCache: function() {
    this.redisCache = new RedisApiCache({
      max: 5000,
      host: this.redisSettings.host,
      port: this.redisSettings.port,
      debug: this.redisSettings.debug,
      redisOptions: this.redisSettings.options,
      opts: {}
    })
  },
  setupRedisClients: function() {
    const ctx = this
    this.redisSubClient = redis.createClient(
      this.redisSettings.port, 
      this.redisSettings.host, 
      this.redisSettings.options
    );
    this.redisPubClient = redis.createClient(
      this.redisSettings.port, 
      this.redisSettings.host, 
      this.redisSettings.options
    );
    this.redisSubClient.subscribe("prismic-update")
    this.redisSubClient.on("message", function(channel, message) {
      ctx.fetch()
    })
  },
  refresh: function() {
    this.redisPubClient.publish("prismic-update", "now")
  },
  fetch: function(cb) {
    const ctx = this
    this.redisCache.remove(this.prismicApiEndpoint) 
    Prismic.api(this.prismicApiEndpoint, {apiCache:this.redisCache}).then((theApi) => {
      ctx.api = theApi
    }).catch((error) => {
      console.log(error)
    })
  }
}

module.exports = RedisCachedPrismicApi;