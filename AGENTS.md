<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

SENTINEL runs as a single interactive route with four in-app views (search, CCTV matrix, ingestion, Re-ID) backed by a typed mock API in src/lib/api.ts and a persisted Zustand store in src/store.ts — keep new operational state there so views stay in sync.
