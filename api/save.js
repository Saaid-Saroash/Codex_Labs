export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { filename, content, message } = req.body || {};

    if (!filename || typeof filename !== "string") {
      return res.status(400).json({ error: "filename is required" });
    }
    if (typeof content !== "string") {
      return res.status(400).json({ error: "content must be a string" });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    const branch = process.env.GITHUB_BRANCH || "main";

    if (!owner || !repo || !token) {
      return res.status(500).json({
        error: "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN environment variables."
      });
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filename).replace(/%2F/g, "/")}`;

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    };

    let sha = null;
    const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (existing.ok) {
      const existingJson = await existing.json();
      sha = existingJson.sha || null;
    }

    const body = {
      message: message || `Update ${filename}`,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch
    };
    if (sha) body.sha = sha;

    const updateResponse = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body)
    });

    const result = await updateResponse.json().catch(() => ({}));
    if (!updateResponse.ok) {
      return res.status(updateResponse.status).json({
        error: result.message || "GitHub update failed",
        details: result
      });
    }

    return res.status(200).json({
      ok: true,
      filename,
      commit: result.commit?.sha || null
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Server error"
    });
  }
}
