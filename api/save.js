export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "https://saaid-saroash.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { filename, content, message } = req.body || {};

    if (!filename) {
      return res.status(400).json({
        error: "Missing filename"
      });
    }

    if (typeof content !== "string") {
      return res.status(400).json({
        error: "Missing content"
      });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return res.status(500).json({
        error: "Missing environment variables",
        owner: !!owner,
        repo: !!repo,
        token: !!token
      });
    }

    const apiUrl =
      `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`;

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    };

    // Get existing file
    const existingResponse = await fetch(
      `${apiUrl}?ref=${encodeURIComponent(branch)}`,
      { headers }
    );

    let sha = undefined;

    if (existingResponse.ok) {
      const existing = await existingResponse.json();
      sha = existing.sha;
    } else if (existingResponse.status !== 404) {
      const err = await existingResponse.text();

      return res.status(existingResponse.status).json({
        error: "Unable to read existing file",
        github: err
      });
    }

    const body = {
      message: message || `Update ${filename}`,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch
    };

    if (sha) body.sha = sha;

    const githubResponse = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body)
    });

    const githubResult = await githubResponse.json();

    if (!githubResponse.ok) {
      return res.status(githubResponse.status).json({
        error: "GitHub rejected the request",
        github: githubResult
      });
    }

    return res.status(200).json({
      success: true,
      filename,
      commit: githubResult.commit?.sha
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
}
