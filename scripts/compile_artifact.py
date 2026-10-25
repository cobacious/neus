#!/usr/bin/env python3
import sys
import os
import re
import html

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background-color: #f8fafc;
      padding: 40px 20px 80px;
    }}
    .container {{
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 48px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }}
    h1 {{ font-size: 28px; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }}
    h2 {{ font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin-top: 36px; margin-bottom: 14px; color: #1e293b; }}
    h3 {{ font-size: 16px; font-weight: 700; margin-top: 24px; margin-bottom: 8px; color: #334155; }}
    p {{ margin-bottom: 16px; font-size: 15px; color: #334155; }}
    hr {{ border: none; border-top: 1px solid #e2e8f0; margin: 32px 0; }}
    table {{ width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; }}
    th, td {{ border: 1px solid #e2e8f0; padding: 10px 14px; text-align: left; }}
    th {{ background: #f8fafc; font-weight: 600; color: #0f172a; }}
    tr:nth-child(even) {{ background: #fcfdfe; }}
    img {{ max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 16px auto; }}
    ul, ol {{ margin-bottom: 16px; padding-left: 24px; font-size: 15px; color: #334155; }}
    li {{ margin-bottom: 6px; }}
    code {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #0f172a; }}
    pre {{ background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 20px; }}
    pre code {{ background: none; padding: 0; color: inherit; }}
    
    /* GitHub Alert Callouts */
    .alert {{
      border-left: 4px solid #4F6D7A;
      background: #f8fafc;
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      margin: 20px 0;
      font-size: 14px;
    }}
    .alert-note {{ border-color: #4F6D7A; background: #EEF3F5; }}
    .alert-tip {{ border-color: #10b981; background: #ecfdf5; }}
    .alert-important {{ border-color: #6366f1; background: #eef2ff; }}
    .alert-warning {{ border-color: #DD6E42; background: #fff7ed; }}
    .alert-title {{ font-weight: 700; margin-bottom: 4px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }}

    /* Mermaid Diagrams */
    .mermaid {{
      display: flex;
      justify-content: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
    }}

    /* Interactive Carousel Component */
    .carousel-widget {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 24px;
      margin: 28px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }}
    .carousel-slide-area {{
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 380px;
      text-align: center;
    }}
    .carousel-slide-content {{
      display: none;
      width: 100%;
      animation: fadeIn 0.25s ease-in-out;
    }}
    .carousel-slide-content.active {{
      display: block;
    }}
    .carousel-slide-content img {{
      max-width: 380px;
      max-height: 400px;
      width: auto;
      height: auto;
      margin: 0 auto 12px;
      border-radius: 12px;
    }}
    .carousel-caption {{
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 8px;
    }}
    .carousel-nav {{
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }}
    .carousel-btn {{
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 6px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }}
    .carousel-btn:hover {{
      background: #f1f5f9;
      border-color: #94a3b8;
    }}
    .carousel-dots {{
      display: flex;
      gap: 6px;
      align-items: center;
    }}
    .carousel-dot {{
      width: 8px;
      height: 8px;
      border-radius: 9999px;
      background: #cbd5e1;
      cursor: pointer;
      transition: all 0.2s;
    }}
    .carousel-dot.active {{
      background: #4F6D7A;
      width: 22px;
    }}
    @keyframes fadeIn {{
      from {{ opacity: 0; transform: translateY(4px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <div id="content"></div>
  </div>

  <script>
    mermaid.initialize({{ startOnLoad: false, theme: 'neutral' }});

    const rawMarkdown = {raw_markdown_json};

    // Custom marked renderer for carousels and mermaid
    const renderer = new marked.Renderer();

    // Render marked content
    document.getElementById('content').innerHTML = marked.parse(rawMarkdown);

    // Initialize carousels
    document.querySelectorAll('.carousel-widget').forEach((widget, wIdx) => {{
      const slides = widget.querySelectorAll('.carousel-slide-content');
      const dotsContainer = widget.querySelector('.carousel-dots');
      const prevBtn = widget.querySelector('.btn-prev');
      const nextBtn = widget.querySelector('.btn-next');
      let current = 0;

      slides.forEach((_, idx) => {{
        const dot = document.createElement('div');
        dot.className = 'carousel-dot' + (idx === 0 ? ' active' : '');
        dot.onclick = () => showSlide(idx);
        dotsContainer.appendChild(dot);
      }});

      function showSlide(idx) {{
        slides[current].classList.remove('active');
        dotsContainer.children[current].classList.remove('active');
        current = (idx + slides.length) % slides.length;
        slides[current].classList.add('active');
        dotsContainer.children[current].classList.add('active');
      }}

      prevBtn.onclick = () => showSlide(current - 1);
      nextBtn.onclick = () => showSlide(current + 1);
    }});

    // Initialize mermaid
    mermaid.run({{
      nodes: document.querySelectorAll('.mermaid')
    }});
  </script>
</body>
</html>"""

def compile_markdown_to_html(md_path, html_path=None):
    if html_path is None:
        html_path = os.path.splitext(md_path)[0] + ".html"
    
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract title from first H1 or filename
    title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    title = title_match.group(1) if title_match else os.path.basename(md_path)

    # 1. Transform ````carousel ... ```` into custom HTML carousel widgets
    def replace_carousel(match):
        block = match.group(1).strip()
        slides = re.split(r"<!--\s*slide\s*-->", block)
        
        slides_html = []
        for idx, slide in enumerate(slides):
            slide_clean = slide.strip()
            # If the slide is an image markdown: ![caption](url)
            img_match = re.search(r"!\[(.*?)\]\((.*?)\)", slide_clean)
            if img_match:
                caption, img_url = img_match.group(1), img_match.group(2)
                # Ensure relative path if local file
                img_src = os.path.basename(img_url) if os.path.isabs(img_url) else img_url
                active_class = " active" if idx == 0 else ""
                slides_html.append(f'''
                  <div class="carousel-slide-content{active_class}">
                    <img src="{img_src}" alt="{html.escape(caption)}">
                    <div class="carousel-caption">{html.escape(caption)}</div>
                  </div>
                ''')
            else:
                # Regular text slide
                active_class = " active" if idx == 0 else ""
                slides_html.append(f'''
                  <div class="carousel-slide-content{active_class}">
                    <div>{html.escape(slide_clean)}</div>
                  </div>
                ''')
        
        slides_markup = "\\n".join(slides_html)
        return f'''
<div class="carousel-widget">
  <div class="carousel-slide-area">
    {slides_markup}
  </div>
  <div class="carousel-nav">
    <button class="carousel-btn btn-prev">&larr; Prev</button>
    <div class="carousel-dots"></div>
    <button class="carousel-btn btn-next">Next &rarr;</button>
  </div>
</div>
'''

    content = re.sub(r"````carousel\s*(.*?)\s*````", replace_carousel, content, flags=re.DOTALL)
    content = re.sub(r"```carousel\s*(.*?)\s*```", replace_carousel, content, flags=re.DOTALL)

    # 2. Transform ````mermaid ... ```` into <pre class="mermaid">
    def replace_mermaid(match):
        diagram = match.group(1).strip()
        return f'<pre class="mermaid">\\n{diagram}\\n</pre>'

    content = re.sub(r"````mermaid\s*(.*?)\s*````", replace_mermaid, content, flags=re.DOTALL)
    content = re.sub(r"```mermaid\s*(.*?)\s*```", replace_mermaid, content, flags=re.DOTALL)

    # 3. Transform GitHub alerts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING]
    def replace_alerts(match):
        alert_type = match.group(1).lower()
        body = match.group(2).strip()
        # strip leading "> " from body lines
        clean_body = "\\n".join(re.sub(r"^>\s*", "", line) for line in body.splitlines())
        return f'''
<div class="alert alert-{alert_type}">
  <div class="alert-title">{alert_type}</div>
  <div>{clean_body}</div>
</div>
'''

    content = re.sub(r">\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\\n((?:>.*\\n?)+)", replace_alerts, content, flags=re.IGNORECASE)

    # 4. Normalize absolute image paths to relative basenames so they load locally
    def normalize_img_paths(match):
        alt = match.group(1)
        src = match.group(2)
        if os.path.isabs(src):
            src = os.path.basename(src)
        return f"![{alt}]({src})"

    content = re.sub(r"!\[(.*?)\]\((.*?)\)", normalize_img_paths, content)

    # Serialize markdown as JSON string for script injection
    import json
    raw_markdown_json = json.dumps(content)

    final_html = TEMPLATE.format(title=html.escape(title), raw_markdown_json=raw_markdown_json)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(final_html)

    print(f"Compiled {md_path} -> {html_path}")
    return html_path

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: compile_artifact.py <path-to-markdown>")
        sys.exit(1)
    compile_markdown_to_html(sys.argv[1])
