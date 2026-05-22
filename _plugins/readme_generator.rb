require 'pathname'

module ReadmeGenerator
  class Generator < Jekyll::Generator
    safe true
    priority :high

    def generate(site)
      readmes = {
        "README.md" => {
          "permalink" => "/",
          "layout" => "home",
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

      processed_paths = {}

      # First, process explicitly registered readmes if they exist
      readmes.each do |rel_path, meta|
        full_path = File.join(site.source, rel_path)
        next unless File.exist?(full_path)

        content = File.read(full_path)
        first_non_blank_line = content.lines.map(&:strip).reject(&:empty?).first
        extracted_title = nil
        if first_non_blank_line && first_non_blank_line.start_with?("# ")
          extracted_title = first_non_blank_line.sub(/^#\s+/, '').strip
        end

        processed_paths[full_path] = {
          "permalink" => meta["permalink"],
          "layout" => meta["layout"],
          "title" => extracted_title || meta["title"]
        }
      end

      # Walk the source directory and find all README.md files dynamically
      Dir.glob(File.join(site.source, "**/README.md"), File::FNM_DOTMATCH).each do |full_path|
        next if processed_paths.key?(full_path)

        # Get relative path to site source
        rel_path = Pathname.new(full_path).relative_path_from(Pathname.new(site.source)).to_s

        # Ignore if any part of the path starts with '.' or '_' (e.g. .git, _site, _layouts, etc.)
        next if rel_path.split(File::SEPARATOR).any? { |part| part.start_with?('.') || part.start_with?('_') }

        dir_path = File.dirname(full_path)

        # Skip if there's already an index.html or an active index.md in the directory
        if File.exist?(File.join(dir_path, "index.html"))
          next
        end
        if File.exist?(File.join(dir_path, "index.md"))
          index_content = File.read(File.join(dir_path, "index.md"))
          unless index_content.include?("published: false")
            next
          end
        end

        content = File.read(full_path)
        first_non_blank_line = content.lines.map(&:strip).reject(&:empty?).first
        extracted_title = nil
        if first_non_blank_line && first_non_blank_line.start_with?("# ")
          extracted_title = first_non_blank_line.sub(/^#\s+/, '').strip
        end

        dir_name = File.dirname(rel_path)
        if dir_name == "."
          permalink = "/"
          title = extracted_title || "Home"
        else
          permalink = "/#{dir_name}/"
          if extracted_title
            title = extracted_title
          else
            folder_name = File.basename(dir_name)
            title = folder_name.split('_').map(&:capitalize).join(' ')
          end
        end

        processed_paths[full_path] = {
          "permalink" => permalink,
          "layout" => "page",
          "title" => title
        }
      end

      # Generate pages for all collected configs
      processed_paths.each do |full_path, meta|
        content = File.read(full_path)
        rel_path = Pathname.new(full_path).relative_path_from(Pathname.new(site.source)).to_s
        dir_name = File.dirname(rel_path)
        dir_name = "" if dir_name == "."

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
