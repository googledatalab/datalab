from unittest import TestCase

from IPython.nbformat import read
from IPython.kernel.tests import utils

class NotebookTester:

  NOTEBOOK_VERSION = 4

  def loadTestsFromFile(self, filename):
      """ find all executable cells in the notebook and make test instances from each.
      """
      nb = read(filename, self.NOTEBOOK_VERSION)

      # Create a kernel to execute the notebook cells.

      _, kernel = utils.start_new_kernel() ##kernel_name=nb.metadata.kernelspec.name)

      for idx, cell in enumerate(nb.cells):
        if cell.cell_type == "code":
          yield TestCase(filename, idx, cell, kernel, scrubs=self.scrubMatch)


class CellTestCase(TestCase):

  def __init__(self, filename, index, cell, kernel):
    self.filename = filename
    self.index = index
    self.cell = cell
    self.kernel = kernel
    self._remove_extraneous_keys(cell.outputs)

  def _remove_extraneous_keys(self, cell):
    """ Remove non-reproducible stuff from the cell. """
    for output in cell.outputs:
      for key in ["execution_count", "traceback"]:
        output.pop(key, None)

  def run(self):
    self.kernel.execute(self.cell.source)

    outputs = []
    while True:
      msg = self.iopub.get_msg(block=True, timeout=1)
      if msg is None:
        continue
      if msg["msg_type"] == "status":
        if msg["content"]["execution_state"] == "idle":
          break
      elif msg["msg_type"] == "execute_input" or msg["msg_type"] == "execute_request":
        continue

      output = {
        u"output_type": msg["msg_type"]
      }
      output.update(msg["content"])
      self._remove_extraneous_keys(output)
      outputs.append(output)

    self.assertEqual(outputs, self.cell.outputs,
                     [outputs, self.cell.outputs])
      #list(self.scrubOutputs(outputs)),
      #list(self.scrubOutputs(self.cell.outputs)),

nbt = NotebookTester()
tests = list(nbt.loadTestsFromFile("content/ipython/notebooks/BigQuery - Composing Queries.ipynb"))
for test in tests:
  test.run()

"""

class Nosebook(Plugin):
    name = "nosebook"

    def options(self, parser, env=os.environ):

        self.testMatchPat = env.get('NOSEBOOK_TESTMATCH',
                                    r'.*[Tt]est.*\.ipynb$')

        parser.add_option(
            "--nosebook-match",
            action="store",
            dest="nosebookTestMatch",
            metavar="REGEX",
            help="Notebook files that match this regular expression are "
                 "considered tests.  "
                 "Default: %s [NOSEBOOK_TESTMATCH]" % self.testMatchPat,
            default=self.testMatchPat
        )
        parser.add_option(
            "--nosebook-scrub",
            action="store",
            default=env.get('NOSEBOOK_SCRUB'),
            dest="nosebookScrub",
            help="a quoted regex, or JSON obj/list of regexen to "
                 "scrub from cell outputs "
                 "[NOSEBOOK_SCRUB]")

        super(Nosebook, self).options(parser, env=env)

    def configure(self, options, conf):
        super(Nosebook, self).configure(options, conf)
        self.testMatch = re.compile(options.nosebookTestMatch).match
        scrubs = []
        if options.nosebookScrub:
            try:
                scrubs = json.loads(options.nosebookScrub)
            except Exception:
                scrubs = [options.nosebookScrub]

        if isinstance(scrubs, str):
            scrubs = {scrubs: "<...>"}
        elif not isinstance(scrubs, dict):
            scrubs = dict([
                (scrub, "<...%s>" % i)
                for i, scrub in enumerate(scrubs)
            ])

        self.scrubMatch = {
            re.compile(scrub): sub
            for scrub, sub in scrubs.items()
        }

    def wantFile(self, filename):
        return self.testMatch(filename) is not None


class NoseCellTestCase(TestCase):
        self.runTest.__func__.__doc__ = self.id()
        super(NoseCellTestCase, self).__init__(*args, **kwargs)

    def id(self):
        return "%s#%s" % (self.filename, self.cell_idx)

    def scrubOutputs(self, outputs):
        for output in outputs:
            out = copy(output)

            for scrub, sub in self.scrubs.items():
                def _scrubLines(obj, key):
                    obj[key] = re.sub(scrub, sub, obj[key])

                if "text" in out:
                    _scrubLines(out, "text")

                if "data" in out:
                    for mime, data in out["data"].items():
                        _scrubLines(out["data"], mime)
            yield out

"""
