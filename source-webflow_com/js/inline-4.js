
(function() {
  var gs = document.createElement('script');
  gs.src = 'https://js.partnerstack.com/v1/';
  gs.type = 'text/javascript';
  gs.async = 'true';
  gs.onload = gs.onreadystatechange = function() {
    var rs = this.readyState;
    if (rs && rs != 'complete' && rs != 'loaded') return;
    try {
      growsumo._initialize("pk_2MURg5tFoHdpERLfsXpSVlnLZbJDoUSN");
      if (typeof(growsumoInit) === 'function') {growsumoInit();}
    } catch (e) {}};
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(gs, s);
  })();