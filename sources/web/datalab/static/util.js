define(() => {
  var debug = {
    enabled: true,
    log: function() { console.log.apply(console, arguments); }
  };

  return {
    debug: debug
  };
});
