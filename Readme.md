# ohtoai.top

Source code for my personal homepage: <https://ohtoai.top>.

A static site built with plain HTML, CSS, and JavaScript — no build step required.

## Features

- Dark, animated landing page with a preloader / curtain transition
- Responsive layout for desktop and mobile
- Project and experiment sections
- `lab/` area for small interactive experiments
- `components/bilibili/` embed component
- `2020/` archive of the older site
- Custom `404.html`

## Local preview

Because the site is fully static, any static file server works:

```bash
# Python 3
python -m http.server 8000

# or Node.js
npx serve .
```

Then open <http://localhost:8000/>.

## Project structure

```text
index.html          main page
404.html            custom 404 page
assets/             CSS, JavaScript, images, fonts
components/         reusable page components (e.g. bilibili)
lab/                interactive experiments
doc/                documentation / notes
2020/               archived version of the site
.github/            GitHub Pages deployment workflow
```

## Deployment

The site is deployed with GitHub Pages. Push changes to the default branch and let the workflow in `.github/` publish the site.

## License

[MIT](LICENSE)
