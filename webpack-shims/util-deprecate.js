/** Minimal shim for nested readable-stream → util-deprecate in browser bundles */
module.exports = function deprecate(fn) {
  return fn;
};
