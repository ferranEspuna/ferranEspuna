require 'pathname'

module ReadmeGenerator
  class Generator < Jekyll::Generator
    safe true
    priority :high

    def generate(site)
      readmes = {
        "README.md" => {
          "permalink" => "/",
          "layout" => "default",
          "title" => "Home"
        },
        "cv/README.md" => {
          "permalink" => "/cv/",
          "layout" => "page",
          "title" => "Curriculum Vitae"
        },
        "recipes/burritos/README.md" => {
          "permalink" => "/recipes/burritos/",
          "layout" => "page",
          "title" => "Quesabirria Burritos"
        },
        "recipes/cookies/README.md" => {
          "permalink" => "/recipes/cookies/",
          "layout" => "page",
          "title" => "Vegan Chocolate Chip Cookies"
        },
        "complex_fractals/README.md" => {
          "permalink" => "/complex_fractals/",
          "layout" => "page",
          "title" => "Complex Fractals"
        }
      }

      readmes.each do |rel_path, meta|
        full_path = File.join(site.source, rel_path)
        next unless File.exist?(full_path)

        content = File.read(full_path)
        dir_name = File.dirname(rel_path)
        dir_name = "" if dir_name == "."

        # Create a dynamic page without a source file in Jekyll's reader
        page = Jekyll::PageWithoutAFile.new(site, site.source, dir_name, "index.md")
        page.content = content
        page.data['layout'] = meta['layout']
        page.data['permalink'] = meta['permalink']
        page.data['title'] = meta['title']

        site.pages << page
      end
    end
  end
end
