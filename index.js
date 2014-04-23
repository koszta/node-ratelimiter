
/**
 * Module dependencies.
 */

var assert = require('assert');

/**
 * Expose `Limiter`.
 */

module.exports = Limiter;

/**
 * Initialize a new limiter with `opts`:
 *
 *  - `id` identifier being limited
 *  - `db` redis connection instance
 *
 * @param {Object} opts
 * @api public
 */

function Limiter(opts) {
  this.id = opts.id;
  this.db = opts.db;
  assert(this.id, '.id required');
  assert(this.db, '.db required');
  this.max = opts.max || 2500;
  this.duration = opts.duration || 3600000;
  this.prefix = 'limit:' + this.id + ':';
}

/**
 * Inspect implementation.
 *
 * @api public
 */

Limiter.prototype.inspect = function(){
  return '<Limiter id='
    + this.id + ', duration='
    + this.duration + ', max='
    + this.max + '>';
};

/**
 * Get values and header / status code and invoke `fn(err, info)`.
 *
 * redis is populated with the following keys
 * that expire after N seconds:
 *
 *  - limit:<id>:count
 *  - limit:<id>:limit
 *  - limit:<id>:reset
 *
 * @param {Function} fn
 * @api public
 */

Limiter.prototype.get = function(fn){
  var count = this.prefix + 'count';
  var limit = this.prefix + 'limit';
  var reset = this.prefix + 'reset';
  var duration = this.duration;
  var max = this.max;
  var db = this.db;

  function mget(){
    var ex = (Date.now() + duration) / 1000 | 0;
    db
    .multi()
    .setnx(count, max)
    .setnx(reset, ex)
    .setnx(limit, max)
    .decr(count)
    .mget(count, limit, reset)
    .exec(function(err, res){
      var n = ~~res[4][0];
      var max = ~~res[4][1];
      var ex = ~~res[4][2];
      if (err) return fn(err);
      if (!!res[1]){
        db
        .multi()
        .expireat(count, ex)
        .expireat(limit, ex)
        .expireat(reset, ex)
        .exec();
      };
      fn(null, {
        total: max,
        remaining: n < 0 ? 0 : n,
        reset: ex
      });
    });
  }

  mget();
};
