/**
 * Generates a sufficiently random v4 UUID.
 */
export function v4 () {
  // Source: http://stackoverflow.com/a/8809472
  // License: CC-BY (Attribution): https://creativecommons.org/licenses/by/3.0/us
  var d = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c=='x' ? r : (r&0x3|0x8)).toString(16);
  });
  return uuid;
}
