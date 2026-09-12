# Task 6 — Infrastructure

## Incident 1 — the invisible deploy

A fix is pushed, the build succeeds, the deployment shows green, but the
change isn't visible in the browser, no errors anywhere, and a colleague
says "it works for me."

What I'd check, in order:

1. **Hard refresh the page, or open it in a private/incognito window.**
   Cheapest possible check. If the change shows up there, it's a browser
   caching issue on my end, not a real deployment problem, and I'm done.
2. **Confirm I'm actually looking at the environment that was just deployed.**
   Am I on the right URL, the right subdomain, the right environment
   (staging vs production)? A "successful deploy" to the wrong target looks
   identical to a failed one from the browser.
3. **Compare the deployed build's version/commit hash to the latest commit.**
   Most deploy tools expose this (a build ID in the footer, a `/version`
   endpoint, or the platform's dashboard). If the deployed hash is older
   than what I just pushed, the deploy didn't actually ship what I think it
   shipped, even though the pipeline reported success.
4. **Check for a CDN or edge cache serving a stale copy.** If there's a CDN
   in front of the app, a "successful deploy" only updates the origin, the
   CDN can keep serving the old cached response until it's invalidated or
   its TTL expires.
5. **Check for a stale service worker.** If the app has a service worker
   caching assets client-side, it can keep serving the old JS/CSS bundle
   indefinitely until it detects an update, which explains why the colleague
   who never had the old version cached ("works for me") sees it fine.

I'd check these in this order because each one is cheaper and faster to rule
out than the last, and together they cover the three places a "successful"
deploy can still fail to reach the user: my own browser, the wrong
environment, and a caching layer between the server and the browser.

## Incident 2 — 502 after deploy

The app works locally, every API call returns 502 after deploying, the
container shows as running, and the only change was a new feature reading a
configuration value.

Most likely causes, in the order I'd check them:

1. **Read the container's logs.** This is the cheapest, fastest check and
   usually tells me directly what's wrong, a missing config value at
   startup often throws a clear error or stack trace right there.
2. **Check whether the new config value actually exists in this
   environment.** The feature reads a config value that presumably exists
   locally (in a `.env` file or local config) but may never have been added
   to the production/staging environment's actual variables. A 502 (not a
   500) often means the app process itself isn't responding at all, which
   fits an app that crashed or failed to start because a required value was
   missing.
3. **Confirm the container is actually healthy, not just "running."** A
   container can show as "running" in the orchestrator's eyes while the app
   process inside has crashed and restarted into a bad state, or is stuck
   in a crash-restart loop. I'd check restart counts and whether the app's
   health check (if one exists) is passing.
4. **Check whether the reverse proxy/load balancer is pointing at the right
   port.** Less likely given the described symptom (a config change is the
   named difference), but worth ruling out if the above don't explain it,
   since a 502 specifically means "the proxy couldn't get a valid response
   from the app," not just "the app returned an error."

The reason I'd start with logs and the missing config value specifically:
the brief itself names the one thing that changed (a new feature reading a
config value), so that's the most likely cause, not a coincidence, and
checking it costs almost nothing compared to digging through
infrastructure layers first.

## Incident 3 — the vanishing change

A colleague installed a tool inside a running container to debug something,
it worked, and after the next deploy the tool is gone with no error, and
their fix stopped working.

**What happened:** a running container is built from an image, and any
change made directly inside a running container (installing a tool, editing
a file by hand) only exists in that one running instance, it's not saved
back into the image. When the next deploy happens, a fresh container gets
created from the original image definition, with none of those manual
changes, so the tool (and anything that depended on it) disappears with no
error, because from the system's point of view nothing went wrong, it just
built a new container exactly the way it was told to.

**How the change should have been made instead:** the tool should have been
added to the actual build definition (the Dockerfile or equivalent build
script) and the image rebuilt and redeployed through the normal pipeline,
so it becomes a permanent part of what every future container starts with,
not a one-off manual patch that only survives until the next deploy wipes
it out.