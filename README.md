# Valima · Adeel & Khadija

Digital invitation for the Valima of Adeel Kamal Ahmad and Khadija Imran Butt.

## Local preview

```bash
python3 -m http.server 8765
```

Open http://127.0.0.1:8765/

Query params:

- `?zoom` — skip the tap and play the AK zoom-in immediately

RSVP submissions need a Valima Google Apps Script URL in `js/rsvp.js` (`APPS_SCRIPT_URL`). Until that is set, the form still shows the thank-you state and does not post.
