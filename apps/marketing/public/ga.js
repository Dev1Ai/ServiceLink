(function(){
  try {
    var s = document.currentScript;
    var id = s && s.dataset && s.dataset.gaId;
    if(!id) return;
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = gtag;
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(g);
    gtag('js', new Date());
    gtag('config', id);
  } catch(e) { /* no-op */ }
})();

