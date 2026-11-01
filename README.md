# Flyradar by steinar

Live flykart for Europa. Én HTML-fil (`index.html`) som kjører i nettleseren.

- `index.html`: selve appen. Publiseres med Cloudflare Pages.
- `worker.js`: proxy for Cloudflare Workers (legger på CORS og slår sammen flere sirkler i ett kall). Lim inn i workeren `flyradar`.

Adressen til proxyen står i `index.html` (`MY_PROXY`).
