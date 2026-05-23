
(function() {

  function getFirstTouchCookie(firstTouchCookieKey) {
    if (!firstTouchCookieKey) return;
    return document.cookie.split(';').find(function(item) {
      return item.trim().indexOf(firstTouchCookieKey + '=') === 0;
    });
  }

  function setFirstTouchCookie(firstTouchCookieKey, firstTouchParams) {
    var expireDate = new Date();
    var domain = window.location.hostname.toString();

    expireDate.setTime(expireDate.getTime() + (365 * 24 * 60 * 60 * 1000));

    document.cookie = [
      firstTouchCookieKey,
      '=',
      encodeURIComponent(JSON.stringify(firstTouchParams)),
      ';secure',
      ';domain=.',
      domain,
      ';path=/',
      ';expires=',
      expireDate.toUTCString(),
    ].join('');
  }

  function parseFirstTouchParams(firstTouchCookieKey, firstTouchCookie) {
    try {
      return JSON.parse(decodeURIComponent(firstTouchCookie).trim().substring(firstTouchCookieKey.length + 1, firstTouchCookie.length))
    } catch (e) {
      console.log(e);
    }
  }

  // We apply a limit on a presignup breadcrumbs entry in order to not allow cookie to grow too big
  // (above 4000 bytes, which was a max size of cookies allowed by our infrastructure
  // when the issue was reported).
  //
  // A sophisticated approach could be to check length of a whole cookie and, if too big in bytes,
  // decide what data to remove from the cookie. But we decided to take a simplified one:
  // we know that "presignup_breadcrumbs" is so far the only first touch cookie's field which
  // grows a lot over time (adding a URL to an array potentially on every page visit), therefore
  // we can focus on that field only. Next, we do not count real bytes in a serialized cookie,
  // but string chars (they could differ for example for emojis, but we do not expect emojis in URLs).
  // Moreover, we ignore bytes added between array entries in a serialized JSON (double quotes, commas,
  // spaces). Instead, we limit URLs to arbitrarily chosen:
  // - max 10 URLs
  // - max 1000 characters (sum of those URLs)
  //
  function limitPresignupBreadcrumbs(breadcrumbs) {
    var urlsLimit = 10;
    var charsLimit = 1000;

    var limitedBreadcrumbs = [];

    var charsTotal = 0;
    for (let i = breadcrumbs.length - 1; i >= 0; i--) {
      if (limitedBreadcrumbs.length < urlsLimit) {
        charsTotal += breadcrumbs[i].length;
        if (charsTotal <= charsLimit) {
          limitedBreadcrumbs.push(breadcrumbs[i]);
        }
      }
    }
    limitedBreadcrumbs.reverse();
    return limitedBreadcrumbs;
  }

    var a_uid='6a112c78d4992f68121add3b';

    // Here we define user properties that are easier to define on the
    // client side
    var _user_meta = {
        'last open marketplace': new Date()
    };

    analytics.identify(a_uid, _user_meta);

    (function limitSizeOfPreviouslyCreatedFirstTouchCookie() {
      var firstTouchCookieKey = 'wf_first_touch';
      var firstTouchCookie = getFirstTouchCookie(firstTouchCookieKey);
      if (!firstTouchCookie) return;

      var firstTouchParams = parseFirstTouchParams(firstTouchCookieKey, firstTouchCookie);
      if (!firstTouchParams) return;

      if (firstTouchParams.presignup_breadcrumbs) {
        firstTouchParams.presignup_breadcrumbs = limitPresignupBreadcrumbs(firstTouchParams.presignup_breadcrumbs);
        setFirstTouchCookie(firstTouchCookieKey, firstTouchParams);
      }
    })();

  })();
