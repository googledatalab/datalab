// Google Cloud Datalab-specific cell output scrubbing for test framework.

window.scrubber = function(mimetype, data) {
  if (data != undefined) {
    data = data.
      // Scrub job IDs.
      replace(/job_[A-Za-z0-9_\-]+/g, "job_").
      // Remove DOM element IDs in require.
      replace(/\element\![0-9_]+/g, "element!").
      // and other DOM ids.
      replace(/\"[0-9][0-9]?_[0-9]+\"/g, "id").
      // remove memory addresses.
      replace(/ at 0x[0-9abcdef]+>/g, ">").
      // Remove chart data source cache indices.
      replace(/dataName:\"[0-9]+\"/g, "dataName").
      // Remove query job metadata except # rows.
      replace(/{"rows": \[.*\]}\);/gm, "ROWS);").
      replace(/<br \/>\(rows: ([0-9]+),[^<]*</g, "<br />(rows: $1)<");
    // We also want to scrub table cell contents inside tbody but not thead.
    // That may be hard with regexp so split first.
    var start = data.indexOf('<tbody>');
    if (start >= 0) {
        data = data.substring(0, start) +
            data.substring(start).replace(/<th>[^<]*<\/th>/g, "<TH>").replace(/<td>[^<]*<\/td>/g, "<TD>");
    }
  }
  return data;
}

window.vcr_matchers = 
  "def scrub_project(uri):\n" +
  "  return re.sub(r'/v2/projects/[^/]*/', '/v2/projects//', uri)\n" +
  "\n" +
  "def datalab_matcher(r1, r2):\n" +
  "  return scrub_project(r1.uri) == scrub_project(r2.uri)\n" +
  "\n" +
  "def vcr_matcher_register(v):\n" +
  "  print 'VCR register'\n" +
  "  v.register_matcher('datalab', datalab_matcher)\n" +
  "  v.match_on = ['datalab']\n";
