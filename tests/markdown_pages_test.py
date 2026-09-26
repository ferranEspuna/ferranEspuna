"""Build checks for GitHub-friendly README page settings. Run with Python 3."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class MarkdownPagesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'source'
        self.output = Path(self.temp.name) / 'output'
        self.source.mkdir()
        shutil.copytree(ROOT / '_plugins', self.source / '_plugins')
        layouts = self.source / '_layouts'
        layouts.mkdir()
        (layouts / 'page.html').write_text('<title>{{ page.title }}</title><article data-columns="{{ page.columns | default: false }}">{{ content }}</article>')
        (layouts / 'complex_fractal.html').write_text('<h1>{{ page.title }}</h1>{{ content }}')
        (self.source / '_config.yml').write_text('markdown: kramdown\nexclude: [docs]\n')

    def write(self, path, text):
        target = self.source / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def build(self):
        return subprocess.run(['bundle', 'exec', 'jekyll', 'build', '--source', str(self.source),
                               '--destination', str(self.output)], cwd=ROOT, capture_output=True, text=True)

    def test_metadata_defaults_and_exclusions(self):
        self.write('README.md', '<!-- page\ntitle: Home\ncolumns: true\n-->\n\n# Welcome\n\n[Fractals](https://ferran.info/complex_fractals/)\n')
        self.write('plain/README.md', '# Plain page\n\nNo settings needed.\n')
        self.write('explorer/README.md', '<!-- page\nlayout: complex_fractal\ntitle: Explorer\npermalink: /custom/\n-->\n\n# Explorer\n\n## Guide\n\nContent.\n')
        self.write('docs/README.md', '# Excluded\n')
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        home = (self.output / 'index.html').read_text()
        self.assertIn('data-columns="true"', home)
        self.assertIn('href="https://ferran.info/complex_fractals/"', home)
        self.assertNotIn('<!-- page', home)
        self.assertNotIn('<table', home)
        plain = (self.output / 'plain/index.html').read_text()
        self.assertIn('<title>Plain page</title>', plain)
        self.assertIn('data-columns="false"', plain)
        self.assertEqual((self.output / 'custom/index.html').read_text().count('<h1'), 1)
        self.assertFalse((self.output / 'README.md').exists())
        self.assertFalse((self.output / 'docs').exists())

    def test_invalid_metadata_has_source_in_error(self):
        self.write('README.md', '<!-- page\ncolumns: [\n-->\n\n# Broken\n')
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Invalid page settings in', result.stdout + result.stderr)
        self.assertIn('README.md', result.stdout + result.stderr)

    def test_duplicate_permalink_fails_build(self):
        self.write('README.md', '# Home\n')
        self.write('other/README.md', '<!-- page\npermalink: /\n-->\n\n# Collision\n')
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Duplicate page URL /', result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
