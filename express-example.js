const express = require('express')
const next = require('next')
const compression = require('compression');
const app = next({ dev })
const RedisCachedPrismicApi = require('./RedisCachedPrismicApi')

var redisSettings = {
  host: 'something.cloud.redislabs.com',
  port: 16290,
  options: {
    password: 'a-secret-password'
  },
  debug: false // true logs all cache requests to console.log
}

const prismicApiEndpoint = 'https://your-repo.prismic.io/api/v2'

let cachedApi = new RedisCachedPrismicApi(prismicApiEndpoint, redisSettings)

app.prepare()
  .then(() => {
    
    const server = express()
    if (process.env.NODE_ENV === "production") {
      server.use(compression())
    }

    server.use( (req, res, next) => {
      const api = cachedApi.api
      req.prismic = { api }
      next()
    })

    server.use(express.json())

    server.post('/prismic', (req, res) => {     
      cachedApi.refresh()
      res.end('Cheers Prismic!')
    })

    server.get('*', (req, res) => {
      return handle(req, res)
    })

    server.listen(port, (err) => {
      if (err) throw err
      console.log(`> Ready on http://localhost:${port}`)
    })

  }