# Redis-cached Prismic API

This is a wrapper around the Prismic Javascript API which allows you to:

* cache the current state of the master 'ref'
* refresh the cached 'ref' when it changes (usually by listening to a webhook)
* cache Prismic API calls using a Redis LRU cache

Prismic-javascript has in-built caching using the DefaultApiCache, which uses an in-memory store for API calls. In lots of situations that works well.

However, for my implementation of Prismic I was finding a few issues:

API calls using the standard examples result in a call to request the current master 'ref' from Prismic, wait for that to return, then make the actual call. I understand from the Prismic team that there is supposed to be some caching here, but using Apache Bench and website speed testing tools, I was getting an 'F' rating for the initial byte for my project.

If you have a Node Express server, the Prismic docs [recommend](https://github.com/prismicio/nodejs-sdk/blob/master/app.js) requesting the current 'ref' per-request like this:

    // Middleware to inject prismic context
    app.use((req, res, next) => {
      res.locals.ctx = {
        endpoint: PrismicConfig.apiEndpoint,
        linkResolver: PrismicConfig.linkResolver,
      };
      // add PrismicDOM in locals to access them in templates.
      res.locals.PrismicDOM = PrismicDOM;
      Prismic.api(PrismicConfig.apiEndpoint, {
        accessToken: PrismicConfig.accessToken,
        req,
      }).then((api) => {
        req.prismic = { api };
        next();
      }).catch((error) => {
        next(error.message);
      });
    });

Moving this outside of the middleware and calling it once reduced the 'chattiness' of my app, but also meant that the API 'ref' would not be updated if I published anything on Prismic.

# Caching calls to Prismic using Redis

Redis offers a very simple and quick way to cache data so it's a good fit for caching Prismic content. It has a few advantages over the default in-memory approach:

* Caching is retained between deployments. If you restart your server, the cache will still be warm.

* Multiple node instances share the same cache so there are fewer cache misses and calls out to the API.

This library wraps the Prismic API and ensures requests are cached in Redis, as well as maintaining an up-to-date 'ref', as long as you implement a webhook from Prismic to your app or otherwise call a refresh.

# Adding the cache to a Next.js / Express app

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

In your Next.js page you could then do this to query for content:

    class Index extends React.Component {

      static async getInitialProps({ req, query }) {
        const page = query.page || 1
        const prismicApi = (req && req.prismic) ? req.prismic.api : (
          await Prismic.api(PrismicConfig.apiEndpoint).then((api) => {
            return api
          })
        )
        const data = await prismicApi.query([ 
          Predicates.at('document.type', 'article')
        ],
        { 
          pageSize: '18', 
          page: page,
          orderings: "[document.first_publication_date desc]"
        }).catch(err => console.log(err));

        return { prismic: data, page: page };
      }

Then set up a webhook in Prismic's admin area to call your app at yourdomain.com/prismic.

On the server, it will cache API queries and render server-side. On the client side it will use the Prismic API as normal.

On startup, the app will refresh the cache and call Prismic to get the latest 'ref'. 

It then sets up a pubsub channel so that if you have multiple instances of your server, any instance receiving the webhook will blow the cache for all instances.

Any thoughts or comments on this, please go to the Prismic Slack channel for discussion. My handle there is @stef.

Cheers! Hopefully this is a useful starting point for others looking at how to make performant Next.js sites using Prismic.



