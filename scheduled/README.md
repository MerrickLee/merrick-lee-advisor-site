# Scheduled Insights posts

Each folder here is one approved post waiting for its go-live time. `.github/workflows/publish-scheduled.yml`
checks this folder every 15 minutes on GitHub's servers. When a post's time has passed, it copies the post into place,
rebuilds the `/insights/` listing, Blog JSON-LD, "Related insights" blocks and `sitemap.xml`, deletes the
post's folder from here and commits to `main`, which makes Vercel deploy the site. No bot has to be running.

This folder is never served by the site (`.vercelignore` plus a redirect in `vercel.json`), but the repo is
public, so anything queued here can be read on GitHub before it goes live.

See "Scheduling a post" in the main README for how to add one.
