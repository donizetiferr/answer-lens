# Security and public-repository privacy

Answer Lens runs in your browser. It does not need API keys or server credentials. Do not add credentials to browser code, bundled assets, examples or deployment files.

Before sharing a change:

- Use synthetic examples. Keep personal/customer data, browser profiles, cookies, session exports, database dumps, raw logs and local operational receipts outside Git.
- Use your GitHub-provided `noreply` author and committer email before creating commits. This affects new commits only; it does not remove existing Git metadata.
- Check screenshots, video frames and metadata for private information.
- Run a full-history and working-tree secret scan. Deleting a secret in a later commit or adding it to `.gitignore` does not remove prior exposure.
- Keep GitHub secret scanning and push protection enabled. Never bypass a credential warning to make a push succeed.
- Pass the required **Secret scan** check before merging. The workflow uses a checksum-verified scanner, read-only permissions and redacted output; it does not publish scan reports.

The checks reduce exposure risk; they do not prove that every possible secret or personal datum is absent. Review remains necessary, especially for media, encoded data and newly supported credential formats.

If you discover a sensitive value, do not paste it into a public issue or pull request. Use GitHub private vulnerability reporting. Revoke or rotate exposed credentials first; coordinate any history cleanup separately because existing clones and caches may retain them.
