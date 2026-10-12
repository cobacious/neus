import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import GitHubIcon from './components/GitHubIcon';

export default function AboutPage() {
  useEffect(() => {
    document.title = 'About - Neus';
    return () => {
      document.title = 'Neus - Neutral News';
    };
  }, []);
  return (
    <article className="space-y-8 pb-12">
      {/* Back button */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center text-gray-500 hover:text-gray-900 font-medium transition-colors text-sm"
        >
          ← Back to Neus feed
        </Link>
      </div>

      {/* Hero / Header Card */}
      <header className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 shadow-xs">
        <div className="inline-block px-2.5 py-0.5 mb-3 text-xs font-semibold tracking-wide uppercase bg-blue-50 text-blue-800 rounded-full border border-blue-200">
          Mission & Architecture
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">About Neus</h1>
        <p className="mt-3 text-base sm:text-lg text-gray-600 leading-relaxed">
          A news aggregation experiment exploring how AI, semantic clustering and objective
          synthesis can restore balance and neutrality to the news feed.
        </p>
      </header>

      {/* Why Neus Exists */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 shadow-xs space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Why Neus Exists</h2>
        <div className="space-y-3 text-gray-700 leading-relaxed text-sm sm:text-base">
          <p>
            News today has been distorted by social media and the brutal economics of the web. The
            algorithms that decide what we see are tuned to maximize engagement, usually by
            provoking anger, fear or division. To compete for attention, publishers are forced to
            play the same game, flooding us with clickbait and manufactured outrage.
          </p>
          <p>
            <strong>Neus</strong> was created as an antidote to that cycle: an experiment in using
            AI and semantic clustering to de-escalate the news, strip away sensationalism and
            present factual reporting with clear neutrality.
          </p>
        </div>
      </section>

      {/* Core Principles */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 shadow-xs space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Core Principles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 space-y-1.5">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-[#4F6D7A]" />
              Tone Neutrality
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-normal">
              Headlines and summaries are rewritten with detached, matter-of-fact language,
              stripping away emotionally charged framing and partisan hyperbole.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 space-y-1.5">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-[#DD6E42]" />
              Multi-Angle Structure
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-normal">
              Rather than collapsing everything into a single headline, stories with multiple
              distinct viewpoints are organized into explicit angles under an overarching
              macro-overview.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 space-y-1.5">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-[#805448]" />
              Chronological Context
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-normal">
              Timeline sparklines and adaptive histograms illustrate when coverage peaked and how it
              unfolded, replacing artificial breaking-news panic with temporal perspective.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 space-y-1.5">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-[#575353]" />
              Source Attribution
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-normal">
              We never conceal original reporting. Every angle explicitly cites its source
              publications with favicons, timestamps and paywall indicators.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works (The Pipeline) */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">How It Works</h2>
          <p className="text-sm text-gray-500 mt-1">
            An automated, multi-stage backend pipeline processes raw RSS feeds into structured
            stories.
          </p>
        </div>

        <ol className="relative border-l border-gray-200 ml-3 space-y-6">
          <li className="ml-6">
            <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full -left-3 ring-4 ring-white text-xs font-semibold">
              1
            </span>
            <h3 className="font-semibold text-gray-900 text-sm">RSS Feed Monitoring</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-normal">
              The engine periodically polls trusted broadsheet and wire feeds across the ideological
              spectrum, recording publication metadata and article snippets.
            </p>
          </li>

          <li className="ml-6">
            <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full -left-3 ring-4 ring-white text-xs font-semibold">
              2
            </span>
            <h3 className="font-semibold text-gray-900 text-sm">
              Vector Embedding & Semantic Clustering
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-normal">
              Incoming articles are converted into high-dimensional semantic embeddings. Unclustered
              articles are grouped using cosine similarity algorithms to detect emerging topics.
            </p>
          </li>

          <li className="ml-6">
            <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full -left-3 ring-4 ring-white text-xs font-semibold">
              3
            </span>
            <h3 className="font-semibold text-gray-900 text-sm">Story Angle Organization</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-normal">
              Related clusters are grouped under umbrella stories. Stories with insufficient angle
              variety are pruned and articles are realigned to their most coherent angle.
            </p>
          </li>

          <li className="ml-6">
            <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full -left-3 ring-4 ring-white text-xs font-semibold">
              4
            </span>
            <h3 className="font-semibold text-gray-900 text-sm">Neutral AI Synthesis</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-normal">
              Google Gemini generates neutral, factual headlines, angle summaries and high-level
              macro-overviews based strictly on cross-source reporting evidence.
            </p>
          </li>

          <li className="ml-6">
            <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full -left-3 ring-4 ring-white text-xs font-semibold">
              5
            </span>
            <h3 className="font-semibold text-gray-900 text-sm">Adaptive Timeline Histograms</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-normal">
              Article timestamps are dynamically bucketed into 15-minute, 1-hour or daily bins
              according to story longevity, visualizing reporting cadence without temporal
              distortion.
            </p>
          </li>
        </ol>
      </section>

      {/* Feed Ranking */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 shadow-xs space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Feed Ranking</h2>
        <div className="space-y-3 text-gray-700 leading-relaxed text-sm sm:text-base">
          <p>
            Rather than relying on click-through algorithms or virality signals, Neus ranks stories
            using a newsworthiness formula designed around journalistic weight:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-xs sm:text-sm text-gray-600">
            <li>
              <strong className="text-gray-800">Cross-Source Consensus:</strong> Stories covered by
              multiple independent publications receive higher visibility than solitary reports.
            </li>
            <li>
              <strong className="text-gray-800">Coverage Depth & Angles:</strong> Stories spanning
              multiple distinct editorial facets naturally bubble up.
            </li>
            <li>
              <strong className="text-gray-800">Recency & Decay:</strong> An exponential half-life
              decay function surfaces active, developing news while allowing older stories to
              gracefully recede.
            </li>
          </ul>
        </div>
      </section>

      {/* Sources & Editorial Scope */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 shadow-xs space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Sources & Scope</h2>
        <div className="space-y-3 text-gray-700 leading-relaxed text-sm sm:text-base">
          <p>
            Neus is focused on UK and world news, indexing established publications including the
            BBC, Reuters, The Guardian, Financial Times, The Telegraph, The Independent and Sky
            News.
          </p>
        </div>
      </section>

      {/* Public Repository & All Rights Reserved */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 shadow-xs space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Transparency & Codebase</h2>
        <div className="space-y-3 text-gray-700 leading-relaxed text-sm sm:text-base">
          <p>
            Neus is created and maintained by{' '}
            <a
              href="https://github.com/cobacious"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium"
            >
              @cobacious
            </a>
            .
          </p>
          <p>
            In the interest of full technical transparency, the complete codebase (including the
            pipeline, clustering logic and web interface) is publicly viewable on GitHub:
          </p>
          <div className="pt-1">
            <a
              href="https://github.com/cobacious/neus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <GitHubIcon className="h-4 w-4" />
              <span>View cobacious/neus on GitHub</span>
            </a>
          </div>
          <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            <strong>Note on licensing:</strong> While the repository is publicly accessible for
            audit, review and feedback, all rights are reserved. It is not licensed for
            redistribution, scraping or commercial reuse without explicit permission.
          </p>
        </div>
      </section>

      {/* Support & Feedback */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <svg className="h-5 w-5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-.781-1.638-.394-.475-.898-.847-1.465-1.082C17.27 2.793 16.643 2.667 16 2.667H4c-.796 0-1.559.316-2.121.879C1.316 4.108 1 4.871 1 5.667v10.666c0 .796.316 1.559.879 2.122.562.562 1.325.878 2.121.878h10c.796 0 1.559-.316 2.121-.878.563-.563.879-1.326.879-2.122v-1.334h3.2c.742 0 1.454-.295 1.979-.82.525-.526.82-1.237.82-1.979V8.415a4.01 4.01 0 00-.783-2zm-3.216 6.252v-6.66h1c.477 0 .935.19 1.273.527.337.338.527.796.527 1.273v2.86c0 .478-.19.936-.527 1.273a1.799 1.799 0 01-1.273.527h-1z" />
              </svg>
              Support Neus
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-normal">
              Neus is an independent, non-commercial prototype. If you find this project valuable
              and would like to help offset hosting and LLM API costs, you can support development
              on Ko-fi.
            </p>
          </div>
          <div>
            <a
              href="https://ko-fi.com/cobacious"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full px-4 py-2 border border-orange-300 bg-orange-50 text-orange-800 font-medium rounded-lg text-sm hover:bg-orange-100 transition-colors"
            >
              Support on Ko-fi
            </a>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <svg
                className="h-5 w-5 text-gray-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              Share Feedback
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-normal">
              Encountered a clustering anomaly, have thoughts on our neutral summarization or want
              to suggest new sources? Feedback and issue reports are warmly welcomed on GitHub.
            </p>
          </div>
          <div>
            <a
              href="https://github.com/cobacious/neus/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full px-4 py-2 border border-gray-300 bg-gray-50 text-gray-800 font-medium rounded-lg text-sm hover:bg-gray-100 transition-colors"
            >
              Open GitHub Issue
            </a>
          </div>
        </div>
      </section>
    </article>
  );
}
