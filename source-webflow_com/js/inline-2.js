
(function () {
  function getCookieValue(name) {
    var cookies = '; ' + document.cookie;
    var parts = cookies.split('; ' + name + '=');
    if (parts.length <= 1) {
      return;
    }
    var val = parts.pop().split(';').shift();
    try {
      return val;
    } catch (e) {
    }
  }

  // Set custom parameters
  window._pxParam1 = getCookieValue('wf_user');

  var scriptSrc = '/TG2vkiqj/init.js';
  var scriptIdMatch = scriptSrc.match(/\/([^\/]+)\/init\.js/);

  if (scriptIdMatch && scriptIdMatch[1]) {
    var scriptId = scriptIdMatch[1];
    var configVarName = '_PX' + scriptId;

    var config = {
      "challenge": {
        "context": {
          "headerText": "Confirm you're not a bot",
          "logoImgSrc": "https://dhygzobemt712.cloudfront.net/Mark/Mark_Logo_Blue.png",
          "headerFontSize": "20px",
          "headerFontWeight": "600",
          "headerFontFamily": "WF Visual Sans",
          "fontLinks": [
            "https://dhygzobemt712.cloudfront.net/Fonts/VF/wf-visualsans-variable-essentials.css",
            "https://fonts.googleapis.com/css?family=Inter"
          ],
          "messageFontFamily": "Inter",
          "messageText": "Before we continue, press and hold the button to confirm you're human.",
          "messageFontSize": "13px",
          "messageFontWeight": "400",
          "headerColor": "#000",
          "messageColor": "#000"
        },
        "view": {
          "borderRadius": 4,
          "backgroundColor": "#006acc",
          "targetColor": "#FFF",
          "textColor": "#ffffff"
        },
        "translation": {
          "default": {
            "btn": "Press and hold"
          }
        }
      }
    };

    window[configVarName] = config;
  }

  // NOW load the script after configuration is set
  var p = document.getElementsByTagName('script')[0];
  var s = document.createElement('script');
  s.async = 1;
  s.src = scriptSrc;

  if (p && p.parentNode) {
    p.parentNode.insertBefore(s, p);
  } 

}());