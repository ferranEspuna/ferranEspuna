# Keep README files readable on GitHub while still providing Jekyll page data.
# Settings live in an HTML comment instead of visible YAML front matter.
require 'yaml'

module MarkdownPages
  class Generator < Jekyll::Generator
    safe true
    priority :high

    def generate(site)
      site.static_files.select { |file| File.basename(file.path) == 'README.md' }.each do |file|
        content = File.read(file.path, encoding: 'UTF-8')
        metadata = {}
        if (comment = content.match(/\A\s*<!-- page\s*\n(.*?)\n-->\s*/m))
          begin
            metadata = YAML.safe_load(comment[1]) || {}
          rescue Psych::Exception => error
            raise Jekyll::Errors::FatalException, "Invalid page settings in #{file.relative_path}: #{error.message}"
          end
          unless metadata.is_a?(Hash)
            raise Jekyll::Errors::FatalException, "Page settings in #{file.relative_path} must be a YAML mapping."
          end
          content = content[comment[0].length..]
        end

        directory = File.dirname(file.relative_path.delete_prefix('/'))
        directory = '' if directory == '.'
        heading = content[/^# (.+)$/, 1]
        page = Jekyll::PageWithoutAFile.new(site, site.source, directory, 'index.md')
        page.data.merge!({
          'layout' => 'page',
          'title' => heading || 'Home',
          'permalink' => directory.empty? ? '/' : "/#{directory}/"
        }.merge(metadata))
        # The explorer layout already places its title above the widgets.
        if page.data['layout'] == 'complex_fractal'
          content = content.sub(/\A# [^\n]+\n\s*/, '')
        end
        page.content = content
        if site.pages.any? { |existing| existing.url == page.url }
          raise Jekyll::Errors::FatalException, "Duplicate page URL #{page.url} for #{file.relative_path}."
        end
        site.pages << page
        site.static_files.delete(file)
      end
    end
  end
end
