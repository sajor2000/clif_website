import type { APIRoute } from 'astro';

export const prerender = false;

interface IssueRequest {
  repo: string;
  title: string;
  body: string;
  labels?: string[];
  assignee?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const githubToken = import.meta.env.GITHUB_TOKEN;

    if (!githubToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GitHub integration not configured. Please contact the site administrator.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { repo, title, body, labels = [], assignee }: IssueRequest = await request.json();

    if (!repo || !title || !body) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: repo, title, and body are required.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create issue via GitHub API
    const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title,
        body,
        labels: labels.filter(Boolean),
        ...(assignee && { assignees: [assignee] }),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('GitHub API error:', errorData);

      return new Response(
        JSON.stringify({
          success: false,
          error: errorData.message || 'Failed to create issue on GitHub.',
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const issueData = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        issueUrl: issueData.html_url,
        issueNumber: issueData.number,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating issue:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred. Please try again later.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
